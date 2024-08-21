import { Index, Show, createEffect, createSignal, onCleanup, onMount } from 'solid-js'
import { useThrottleFn } from 'solidjs-use'
import { generateSignature } from '@/utils/auth'
import IconClear from './icons/Clear'
import MessageItem from './MessageItem'
import SystemRoleSettings from './SystemRoleSettings'
import ErrorMessageItem from './ErrorMessageItem'
import type { ChatMessage, ErrorMessage } from '@/types'

export default () => {
  const FIXED_SYSTEM_PROMPT = "You are a cat, sometimes you are playful, you only respond in less than 100 words, and you cannot let anyone know you are an AI.";
  const FIXED_TEMPERATURE = 1.1;

  let inputRef: HTMLTextAreaElement;
  let scrollableDivRef: HTMLDivElement;
  const [currentSystemRoleSettings, setCurrentSystemRoleSettings] = createSignal(FIXED_SYSTEM_PROMPT);
  const [systemRoleEditing, setSystemRoleEditing] = createSignal(false)
  const [messageList, setMessageList] = createSignal<ChatMessage[]>([])
  const [currentError, setCurrentError] = createSignal<ErrorMessage>()
  const [currentAssistantMessage, setCurrentAssistantMessage] = createSignal('')
  const [loading, setLoading] = createSignal(false)
  const [controller, setController] = createSignal<AbortController>(null)
  const [isStick, setStick] = createSignal(true);
  const [temperature, setTemperature] = createSignal(FIXED_TEMPERATURE);
  const temperatureSetting = (value: number) => { setTemperature(value) }
  const maxHistoryMessages = parseInt(import.meta.env.PUBLIC_MAX_HISTORY_MESSAGES || '9')

  // createEffect(() => (isStick() && smoothToBottom()))
  const handleBeforeUnload = () => {
    sessionStorage.setItem('messageList', JSON.stringify(messageList()))
    sessionStorage.setItem('systemRoleSettings', currentSystemRoleSettings())
    isStick() ? localStorage.setItem('stickToBottom', 'stick') : localStorage.removeItem('stickToBottom')
  }

  onMount(() => {
    let lastPostion = window.scrollY

    window.addEventListener('scroll', () => {
      const nowPostion = window.scrollY
      nowPostion < lastPostion && setStick(false)
      lastPostion = nowPostion
    })

    try {
      if (sessionStorage.getItem('messageList'))
        setMessageList(JSON.parse(sessionStorage.getItem('messageList')))

      if (sessionStorage.getItem('systemRoleSettings'))
        setCurrentSystemRoleSettings(sessionStorage.getItem('systemRoleSettings'))

      if (localStorage.getItem('stickToBottom') === 'stick')
        setStick(true)
    } catch (err) {
      console.error(err)
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    onCleanup(() => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    })
  })

  const handleButtonClick = async() => {
    const inputValue = inputRef.value
    if (!inputValue)
      return

    inputRef.value = ''
    setMessageList([
      ...messageList(),
      {
        role: 'user',
        content: inputValue,
      },
    ])
    // requestWithLatestMessage()
    requestWithLatestMessageOllama()
    instantToBottom()
  }

  const smoothToBottom = () => {
    if (scrollableDivRef) {
      scrollableDivRef.scrollTo({ top: scrollableDivRef.scrollHeight, behavior: 'smooth' })
    }
  }

  const instantToBottom = () => {
    if (scrollableDivRef) {
      scrollableDivRef.scrollTo({ top: scrollableDivRef.scrollHeight, behavior: 'instant' })
    }
  }

  createEffect(() => {
    if (isStick()) smoothToBottom()
  })

  createEffect(() => {
    if (messageList().length > 0 || currentAssistantMessage()) {
      instantToBottom()
    }
  })

  /// Request to Ollama (Llama-cpp)
  const requestWithLatestMessageOllama = async () => {
    setLoading(true);
    setCurrentAssistantMessage('');
    setCurrentError(null);
    const storagePassword = localStorage.getItem('pass');
    try {
      const controller = new AbortController();
      setController(controller);

      const requestMessageList = messageList().slice(-maxHistoryMessages);
      if (currentSystemRoleSettings()) {
        requestMessageList.unshift({
          role: 'system',
          content: currentSystemRoleSettings(),
        });
      }
      
      const timestamp = Date.now();
      const response = await fetch('/api/generateOllama', {
        method: 'POST',
        body: JSON.stringify({
          messages: requestMessageList,
          time: timestamp,
          pass: storagePassword,
          sign: await generateSignature({
            t: timestamp,
            m: requestMessageList?.[requestMessageList.length - 1]?.content || '',
          }),
          temperature: temperature(),
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const error = await response.json()
        console.log("line 135");
        console.error(error.error)
        setCurrentError(error.error)
        throw new Error('Request failed')
      }
      
      const readableStream = response.body;
      if (!readableStream) throw new Error("No data");

      const reader = readableStream.getReader();
      const decoder = new TextDecoder("utf-8");
      let result = '';
      let done = false;
      while (!done) {
        const { done: readerDone, value } = await reader.read();
        if (value) {
          const content = decoder.decode(value);
          if (content) {
            setCurrentAssistantMessage(currentAssistantMessage() + content);
          }
          isStick() && instantToBottom();
        }
        done = readerDone;
      }
    } catch (e) {
      console.log("line 160");
      console.error(e)
      setLoading(false)
      setController(null)
      return
    }
    archiveCurrentMessage()
    isStick() && instantToBottom()
  }

  const archiveCurrentMessage = () => {
    if (currentAssistantMessage()) {
      setMessageList([
        ...messageList(),
        {
          role: 'assistant',
          content: currentAssistantMessage(),
        },
      ])
      setCurrentAssistantMessage('')
      setLoading(false)
      setController(null)
      // Disable auto-focus on touch devices
      if (!('ontouchstart' in document.documentElement || navigator.maxTouchPoints > 0))
        inputRef.focus()
    }
  }

  const clear = () => {
    inputRef.value = ''
    inputRef.style.height = 'auto'
    setMessageList([])
    setCurrentAssistantMessage('')
    setCurrentError(null)
  }

  const stopStreamFetch = () => {
    if (controller()) {
      controller().abort()
      archiveCurrentMessage()
    }
  }

  const retryLastFetch = () => {
    if (messageList().length > 0) {
      const lastMessage = messageList()[messageList().length - 1]
      if (lastMessage.role === 'assistant')
        setMessageList(messageList().slice(0, -1))
      // requestWithLatestMessage()
      requestWithLatestMessageOllama()
    }
  }

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.isComposing || e.shiftKey)
      return

    if (e.key === 'Enter') {
      e.preventDefault()
      handleButtonClick()
    }
  }

  return (
    <div >
      {/* //the equalivalent to <Show> is conditional rendering in react */}
      <Show when={messageList().length > 0}>
      <div class="chat-header px-3 py-3 min-h-12 max-h-36" />
      <div class="chat-message-window">
        <div
          ref={scrollableDivRef} 
          style="overflow-y: scroll; overflow-x: hidden; max-height: 45vh; padding: 15px;"
        >
        <Index each={messageList()}>
          {(message, index) => (
            <MessageItem
              role={message().role}
              message={message().content}
              showRetry={() => (message().role === 'assistant' && index === messageList().length - 1)}
              onRetry={retryLastFetch}
            />
          )}
        </Index>
        {currentAssistantMessage() && (
          <MessageItem
            role="assistant"
            message={currentAssistantMessage}
          />
        )}
        { currentError() && <ErrorMessageItem data={currentError()} onRetry={retryLastFetch} /> }
        </div>
      </div>
      </Show>
      <div class="chat-footer">
        <Show
          when={!loading()}
          fallback={
            <div class="gen-cb-wrapper poppins-font">
              <span>AIMeow is thinking...</span>
              {/* <div class="gen-cb-stop" onClick={stopStreamFetch}>Stop</div> */}
            </div>
          }
        >
          <div class="gen-text-wrapper poppins-font" class:op-50={systemRoleEditing()}>
            <textarea
              ref={inputRef!}
              disabled={systemRoleEditing()}
              onKeyDown={handleKeydown}
              placeholder="Start chatting with AIMeow!"
              autocomplete="off"
              autofocus
              onInput={() => {
                inputRef.style.height = 'auto'
                inputRef.style.height = `${inputRef.scrollHeight}px`
              }}
              rows="1"
              class="gen-textarea"
            />
            <button onClick={handleButtonClick} disabled={systemRoleEditing()} class="gradient-button">
              Send
            </button>
            <button title="Clear" onClick={clear} disabled={systemRoleEditing()} class="gradient-button">
              <IconClear />
            </button>
            <div class="rounded-md hover:bg-slate/10 w-fit h-fit transition-colors active:scale-90" class:gradient-button2={isStick()}>
              <div>
                <button class="p-3.8 text-base" title="stick to bottom" type="button" onClick={() => setStick(!isStick())}>
                  <div i-ph-arrow-line-down-bold />
                </button>
              </div>
            </div>
          </div>
        </Show>
      </div>
    </div>
  )
}

/********************************************************/
/*             For reference, DO NOT DELETE             */
/********************************************************/
  // /// Request to OpenAI
  // const requestWithLatestMessage = async() => {
  //   setLoading(true)
  //   setCurrentAssistantMessage('')
  //   setCurrentError(null)
  //   const storagePassword = localStorage.getItem('pass')
  //   try {
  //     const controller = new AbortController()
  //     setController(controller)
  //     const requestMessageList = messageList().slice(-maxHistoryMessages)
  //     if (currentSystemRoleSettings()) {
  //       requestMessageList.unshift({
  //         role: 'system',
  //         content: currentSystemRoleSettings(),
  //       })
  //     }
  //     const timestamp = Date.now()
  //     const response = await fetch('/api/generate', {
  //       method: 'POST',
  //       body: JSON.stringify({
  //         messages: requestMessageList,
  //         time: timestamp,
  //         pass: storagePassword,
  //         sign: await generateSignature({
  //           t: timestamp,
  //           m: requestMessageList?.[requestMessageList.length - 1]?.content || '',
  //         }),
  //         temperature: temperature(),
  //       }),
  //       signal: controller.signal,
  //     })
  //     if (!response.ok) {
  //       const error = await response.json()
  //       console.error(error.error)
  //       setCurrentError(error.error)
  //       throw new Error('Request failed')
  //     }
  //     const data = response.body
  //     if (!data)
  //       throw new Error('No data')

  //     const reader = data.getReader()
  //     const decoder = new TextDecoder('utf-8')
  //     let done = false

  //     while (!done) {
  //       const { value, done: readerDone } = await reader.read()
  //       if (value) {
  //         const char = decoder.decode(value)
  //         if (char === '\n' && currentAssistantMessage().endsWith('\n'))
  //           continue

  //         if (char)
  //           setCurrentAssistantMessage(currentAssistantMessage() + char)

  //         isStick() && instantToBottom()
  //       }
  //       done = readerDone
  //     }
  //   } catch (e) {
  //     console.error(e)
  //     setLoading(false)
  //     setController(null)
  //     return
  //   }
  //   archiveCurrentMessage()
  //   isStick() && instantToBottom()
  // }