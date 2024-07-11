import { createSignal, onMount } from 'solid-js';
// import DarkLogo from './logos/DarkLogo.astro';
// import LightLogo from './logos/LightLogo.astro';
import darkLogo from "./logos/darklogo-resized.svg";
import lightLogo from "./logos/lightlogo-resized.svg";
import { model } from '../utils/openAI';
import Themetoggle from './Themetoggle.astro';

export default () => {
    const [theme, setTheme] = createSignal('light');

    const getInitialTheme = () => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('theme') 
                || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        }
        return 'light';
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
                    (<img src={darkLogo} alt="ChatGPT" class="logo" />)
                    : (<img src={lightLogo} alt="ChatGPT" class="logo" />)
                }
                
            </div>
            <div class="fi mt-2">
                <span class="gpt-title">ChatGPT</span>
                <span class="gpt-subtitle">Demo</span>
            </div>
        <p mt-1 op-60>Based on OpenAI API ({model}).</p>
        </header>
    )
}