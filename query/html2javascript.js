const fs = require('fs');
const readline = require('readline');
const prompt = require('prompt-sync')();

// Function to read, edit, and write HTML file
function editHtmlFile(inputFilePath, outputFilePath) {
    const fileStream = fs.createReadStream(inputFilePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    const outputStream = fs.createWriteStream(outputFilePath);

    rl.on('line', (line) => {
        // Transform the line using the provided callback
        const editedLine = "'" + line "\n'";
        outputStream.write(editedLine);
    });

    rl.on('close', () => {
        outputStream.end();
        console.log('File processing completed.');
    });
}

// Replace 'input.html' with the actual path to the input HTML file
// Replace 'output.html' with the desired path for the output HTML file
editHtmlFile('index.html', 'index.js', (line) => {
    // Modify this callback to apply your desired transformation to each line
    return line;
});
