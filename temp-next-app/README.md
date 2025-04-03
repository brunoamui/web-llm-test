# Web-LLM Test Application

This application demonstrates using the web-llm library to run Hugging Face models directly in your browser without server-side inference. All processing happens locally using WebGPU acceleration.

## Features

- Run various Hugging Face models directly in your browser
- Configure model parameters (temperature, max tokens, etc.)
- Save configurations to localStorage for persistence
- Chat interface with streaming responses
- Responsive UI built with shadcn/ui components

## Prerequisites

- A modern browser with WebGPU support (Chrome 113+ or Edge 113+)
- Node.js 18.18.0 or later
- Yarn or npm package manager

## Getting Started

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd web-llm-test
   ```

2. Install dependencies:
   ```bash
   yarn install
   # or
   npm install
   ```

3. Run the development server:
   ```bash
   yarn dev
   # or
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Supported Models

The application supports various models from the web-llm library, including:

- **Llama Family**: Llama 3, Llama 2, Hermes-2-Pro-Llama-3
- **Phi**: Phi 3, Phi 2, Phi 1.5
- **Gemma**: Gemma-2B
- **Mistral**: Mistral-7B-v0.3, Hermes-2-Pro-Mistral-7B
- **Qwen (通义千问)**: Qwen2 0.5B, 1.5B, 7B

The default model is `Llama-3.1-8B-Instruct-q4f32_1-MLC`.

## Model Parameters

You can configure the following parameters for each model:

- **Temperature**: Controls the randomness of the model's outputs (0-2)
- **Max Tokens**: Limits the length of the generated response
- **Top P**: Nucleus sampling parameter (0-1)
- **Repetition Penalty**: Reduces repetition in the output (1-2)

## Important Notes

- The first time you use a model, it will be downloaded to your browser cache. This may take some time depending on your internet connection speed.
- All processing happens locally in your browser, so your computer's capabilities affect performance.
- WebGPU acceleration requires a compatible GPU and browser.

## Technology Stack

- **Next.js**: React framework for the UI
- **web-llm**: Library for running LLMs in the browser
- **shadcn/ui**: UI component library
- **TypeScript**: For type safety
- **Tailwind CSS**: For styling

## License

This project is open source and available under the MIT license.
