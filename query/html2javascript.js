const fs = require('fs');
const readline = require('readline');
const prompt = require('prompt-sync')();

console.log("newline char: " + unescape("\\n"))

const inputFile = prompt('Provide the name of the input file (.html)?');
console.log(`Input file name: ${inputFile}`);

const outputFile = prompt('Provide the name of the output file (.js)?');
console.log(`Output file name: ${outputFile}`);    

// Function to read, edit, and write HTML file
function editHtmlFile(inputFilePath, outputFilePath) {
    const fileStream = fs.createReadStream(inputFilePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    const outputStream = fs.createWriteStream(outputFilePath);

    rl.on('line', (line) => {
        // Transform the line
        const editedLine = unescape("+ String.raw`" + line + "` + `\\n`\n");
        console.log(editedLine)
        outputStream.write(editedLine);
    });

    rl.on('close', () => {
        outputStream.end();
        console.log('File processing completed.');
    });
}

// Replace 'input.html' with the actual path to the input HTML file
// Replace 'output.html' with the desired path for the output HTML file
editHtmlFile(inputFile, outputFile, (line) => {
    // Modify this callback to apply your desired transformation to each line
    return line;
});
