import { createSignal, onMount } from 'solid-js';
// import DarkLogo from './logos/DarkLogo.astro';
// import LightLogo from './logos/LightLogo.astro';
// import darkLogo from "./logos/darklogo-resized.svg";
import lightLogo from "./logos/lightlogo-resized.svg";
import AiMeowLogo from "./logos/AIMEOW_Logo.svg";
import "@fontsource/poppins";
// import { model } from '../utils/openAI';
// import Themetoggle from './Themetoggle.astro';

export default () => {
    const [theme, setTheme] = createSignal('light');

    const getInitialTheme = () => {
        // if (typeof window !== 'undefined') {
        //     return localStorage.getItem('theme') 
        //         || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        // }
        // return 'light';

        // Always use dark theme
        return 'dark';
    }

    onMount(() => {
        setTheme(getInitialTheme());
        document.documentElement.classList.toggle('dark', theme() === 'dark');

        const handleThemeChange = () => {
            setTheme(getInitialTheme());
        };

        window.addEventListener("themeChange", handleThemeChange);

        return () => {
            window.removeEventListener("themeChange", handleThemeChange);
        };
    });

    return (
        <header>
            <div class="fb items-center">

                {theme() === "dark" ? 
                    (<img src={AiMeowLogo} alt="ChatGPT" class="logo" />)
                    : (<img src={lightLogo} alt="ChatGPT" class="logo" />)
                }
                
            </div>
            <div class="fi mt-5">
                <span class="gpt-title">LLaMA3.1-Chat</span>
                <span class="gpt-subtitle" style={{ "font-family": "Poppins"}}>Demo</span>
            </div>
        </header>
    )
}