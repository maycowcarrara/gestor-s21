/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Paleta personalizada para o S-21 Digital
                teocratico: {
                    blue: '#4a6da7', // Azul clássico
                    lightBlue: '#eef2fa', // Fundo de cartões
                    gray: '#f5f5f5', // Fundo da tela
                    dark: '#1f2937', // Texto principal
                    red: '#dc2626', // Para alertas (Inativo/Irregular)
                    green: '#16a34a' // Para status ok
                }
            }
        },
    },
    plugins: [],
}