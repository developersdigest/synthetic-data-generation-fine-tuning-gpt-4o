import * as fs from 'fs';
import * as path from 'path';

const inputFolder = 'svgs';
const outputFile = 'fine_tuning_data.jsonl';

function generateJSONL(): void {
    const files = fs.readdirSync(inputFolder);

    const jsonlData = files.map(file => {
        const filePath = path.join(inputFolder, file);
        const svg = fs.readFileSync(filePath, 'utf-8');
        const description = path.basename(file, '.svg').replace(/_/g, ' ');

        return JSON.stringify({
            messages: [
                {
                    role: "system",
                    content: "You are an AI assistant specialized in generating SVG code based on descriptions. Provide only the SVG code without any explanations or markdown formatting."
                },
                {
                    role: "user",
                    content: `Generate an SVG for: ${description}`
                },
                {
                    role: "assistant",
                    content: svg
                }
            ]
        });
    });

    fs.writeFileSync(outputFile, jsonlData.join('\n'));
    console.log(`Generated JSONL file: ${outputFile}`);
}

generateJSONL();