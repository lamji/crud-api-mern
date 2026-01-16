const fs = require('fs');
const path = require('path');

// Define file paths
const inputFilePath = path.resolve(__dirname, '../../ecomv1/src/lib/data/products.ts');
const outputFilePath = path.resolve(__dirname, '../full-product-payload.json');

console.log(`Reading from: ${inputFilePath}`);
console.log(`Writing to: ${outputFilePath}`);

// Read the TypeScript file content
fs.readFile(inputFilePath, 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading the products.ts file:', err);
    return;
  }

  try {
    // Isolate the baseProducts array string from the file content
    const startIndex = data.indexOf('const baseProducts: Product[] = [');
    if (startIndex === -1) {
      throw new Error('Could not find the start of the baseProducts array.');
    }
    const arrayString = data.substring(startIndex + 'const baseProducts: Product[] = '.length);
    const endIndex = arrayString.lastIndexOf('];');
    if (endIndex === -1) {
      throw new Error('Could not find the end of the baseProducts array.');
    }
    const objectLiteralString = arrayString.substring(0, endIndex + 1);

    // Use a safer method to evaluate the object literal string
    const productsArray = (new Function(`return ${objectLiteralString}`))();
    
    // Remove the 'id' field from each product
    const cleanedProducts = productsArray.map(product => {
        const { id, ...rest } = product;
        return rest;
    });

    const finalPayload = { products: cleanedProducts };

    // Write the final JSON payload to the output file
    fs.writeFile(outputFilePath, JSON.stringify(finalPayload, null, 2), 'utf8', (writeErr) => {
      if (writeErr) {
        console.error('Error writing the JSON file:', writeErr);
        return;
      }
      console.log(`Successfully converted and saved the full payload to ${outputFilePath}`);
    });
  } catch (parseError) {
    console.error('Error converting the data to JSON:', parseError);
    console.error('There might be a syntax issue in the source file that the script cannot handle automatically.');
  }
});
