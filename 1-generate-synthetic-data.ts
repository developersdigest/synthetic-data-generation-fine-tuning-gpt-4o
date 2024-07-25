// 1. Import necessary modules
import Portkey from 'portkey-ai';
import * as fs from 'fs';
import * as path from 'path';

// 2. Define configuration interface to ensure type safety and structure for our settings
interface Config {
    svgExamples: string[];
    outputCount: number;
    outputFolder: string;
    model: string;
    maxRetries: number;
    retryDelay: number;
    temperature: number;
    maxTokens: number;
    generationDelay: number;
    virtualKey: string;
}

// 3. Set up configuration object with detailed settings for SVG generation and API calls
const config: Config = {
    svgExamples: [
        "A simple smiley face with circular eyes and a curved mouth",
        "A minimalist landscape with a sun, mountains, and trees",
        "An abstract geometric pattern with circles and squares",
        "A stylized cat face with whiskers and pointed ears",
        "A simple weather icon showing a cloud with raindrops"
    ],
    outputCount: 10,
    outputFolder: 'svgs',
    model: "anthropic.claude-3-5-sonnet-20240620-v1:0",
    maxRetries: 3,
    retryDelay: 3000,
    temperature: 0.7,
    maxTokens: 3000,
    generationDelay: 2000,
    virtualKey: process.env.PORTKEY_BEDROCK_VIRTUAL_KEY as string
};

console.log('Configuration loaded:', config);

// 4. Initialize Portkey client for making API calls to the language model
const portkey = new Portkey({
    apiKey: process.env.PORTKEY_API_KEY,
    virtualKey: config.virtualKey,
});

console.log('Portkey client initialized');

// 5. Define arrays for randomization to create diverse SVG prompts
const shapes = ['circle', 'rectangle', 'triangle', 'ellipse', 'line', 'polygon', 'path'];
const colors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'teal', 'brown', 'gray'];
const themes = ['nature', 'technology', 'abstract', 'emotions', 'space', 'music', 'food', 'sports', 'animals', 'weather'];
const styles = ['minimalist', 'geometric', 'hand-drawn', 'pixel art', 'art deco', 'cubist', 'pop art'];

// 6. Helper function to get a random element from an array, used for generating diverse prompts
function getRandomElement(arr: string[]): string {
    return arr[Math.floor(Math.random() * arr.length)];
}

// 7. Generate a random prompt for SVG creation by combining random elements from our arrays
function generateRandomPrompt(): string {
    const shape = getRandomElement(shapes);
    const color = getRandomElement(colors);
    const theme = getRandomElement(themes);
    const style = getRandomElement(styles);
    return `Create a ${style} SVG image of a ${color} ${shape} related to ${theme}`;
}

// 8. Generate a prompt for new idea generation, ensuring uniqueness by excluding previously used prompts
function generateIdeaPrompt(usedPrompts: string[]): string {
    const newPrompt = generateRandomPrompt();
    const prompt = `Generate a new, unique idea for a simple SVG image based on this prompt: "${newPrompt}".
The idea should be different from these already generated ideas: ${usedPrompts.join(', ')}.
The idea should be described in a single sentence.
Only return the new idea, without any additional explanation.`;
    console.log('Generated idea prompt:', prompt);
    return prompt;
}

// 9. Generate a prompt for SVG code generation, providing specific instructions for the AI model
function generateSVGPrompt(description: string): string {
    const prompt = `Generate SVG code for the following description: "${description}".
The SVG should be simple, clean, and use basic shapes.
Include appropriate viewBox and size attributes.
Incorporate some randomness in the positioning, sizes, or colors of elements.
Use no more than 3-5 shapes or paths.
Do not include any explanations, just return the SVG code.`;
    console.log('Generated SVG prompt:', prompt);
    return prompt;
}

// 10. Function to sanitize filenames by replacing non-alphanumeric characters with underscores
function sanitizeFilename(filename: string): string {
    return filename.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

// 11. Generate a new idea for an SVG using the Portkey API, with retry logic for error handling
async function generateNewIdea(usedPrompts: string[]): Promise<string | null> {
    for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
        console.log(`Attempt ${attempt} to generate new idea using Portkey`);
        try {
            const prompt = generateIdeaPrompt(usedPrompts);
            const chatCompletion = await portkey.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: "You are an AI assistant specialized in generating unique ideas for simple SVG images. Provide only the new idea without any explanations."
                    },
                    { role: "user", content: prompt }
                ],
                stream: false,
                max_tokens: 50,
                model: config.model,
                temperature: config.temperature
            });
            const newIdea = chatCompletion.choices?.[0]?.message?.content?.trim() ?? '';
            console.log('Generated new idea:', newIdea);
            return newIdea;
        } catch (error) {
            console.error(`Attempt ${attempt} failed:`, error);
            if (attempt < config.maxRetries) {
                console.log(`Retrying in ${config.retryDelay / 1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, config.retryDelay));
            }
        }
    }
    console.log('All attempts failed, returning null');
    return null;
}

// 12. Generate SVG code using GPT-4 via the Portkey API, with streaming response and retry logic
async function generateSVGWithGPT4(description: string): Promise<{ description: string; svg: string } | null> {
    for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
        console.log(`Attempt ${attempt} to generate SVG with GPT-4 using Portkey`);
        try {
            const prompt = generateSVGPrompt(description);
            const chatCompletion = await portkey.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: "You are an AI assistant specialized in generating SVG code. Provide only the SVG code without any explanations or markdown formatting."
                    },
                    { role: "user", content: prompt }
                ],
                stream: true,
                max_tokens: config.maxTokens,
                model: config.model,
                temperature: config.temperature
            });
            let accumulatedResponse = "";
            for await (const chunk of chatCompletion) {
                if (chunk.choices[0].finish_reason === "stop" || chunk.choices[0].finish_reason === "length") {
                    console.log('SVG generation completed');
                    break;
                } else if (chunk.choices[0].delta?.content) {
                    accumulatedResponse += chunk.choices[0].delta.content;
                }
            }
            console.log('Generated SVG:', accumulatedResponse.substring(0, 100) + '...');
            const result = {
                description: description,
                svg: accumulatedResponse.trim()
            };
            console.log('Parsed result:', {
                description: result.description,
                svg: result.svg.substring(0, 50) + '...'
            });
            return result;
        } catch (error) {
            console.error(`Attempt ${attempt} failed:`, error);
            if (attempt < config.maxRetries) {
                console.log(`Retrying in ${config.retryDelay / 1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, config.retryDelay));
            }
        }
    }
    console.log('All attempts failed, returning null');
    return null;
}

// 13. Validate the generated SVG to ensure it starts with an SVG tag
function validateSVG(data: { description: string; svg: string }): boolean {
    console.log('Validating SVG');
    const isValid = data.svg.trim().startsWith('<svg');
    console.log('SVG validation result:', isValid);
    return isValid;
}

// 14. Main function to generate and save multiple SVGs
async function generateAndSaveSVGs() {
    console.log('Starting generateAndSaveSVGs function');
    const { outputCount, outputFolder, generationDelay } = config;

    // Create output folder if it doesn't exist
    if (!fs.existsSync(outputFolder)) {
        fs.mkdirSync(outputFolder);
    }

    console.log(`Generating ${outputCount} SVGs using ${config.model}...`);
    const usedPrompts: string[] = [];

    // Loop to generate multiple SVGs
    for (let i = 0; i < outputCount; i++) {
        const newIdea = await generateNewIdea(usedPrompts);
        if (!newIdea) {
            console.log(`Failed to generate new idea for SVG ${i + 1}, skipping`);
            continue;
        }

        usedPrompts.push(newIdea);
        console.log(`Processing SVG ${i + 1}: ${newIdea}`);

        // Generate SVG code and save if valid
        const result = await generateSVGWithGPT4(newIdea);
        if (result && validateSVG(result)) {
            const sanitizedFilename = sanitizeFilename(newIdea);
            const filename = path.join(outputFolder, `${sanitizedFilename}.svg`);
            fs.writeFileSync(filename, result.svg);
            console.log(`Saved SVG to ${filename}`);
        } else {
            console.log('Skipped invalid or null SVG');
        }

        // Add delay between generations to avoid rate limiting
        if (i < outputCount - 1) {
            console.log(`Waiting for ${generationDelay / 1000} seconds before next generation...`);
            await new Promise(resolve => setTimeout(resolve, generationDelay));
        }
    }

    console.log(`\nGenerated and saved SVGs to ${outputFolder}`);
}

// 15. Start the SVG generation process
console.log('Starting the improved SVG generation process');
generateAndSaveSVGs().catch(error => {
    console.error('An error occurred during SVG generation:', error);
});