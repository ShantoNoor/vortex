import fs from "fs/promises";
import path from "path";

export async function addFiles(fileList, activeFolder) {
  const imagesDir = path.join(activeFolder, "images");

  try {
    // 1. Ensure directory exists before writing
    await fs.mkdir(imagesDir, { recursive: true });

    // 2. Use Promise.all for concurrent writing (much faster than sequential loop)
    await Promise.all(
      fileList.map(async (newFile) => {
        try {
          await fs.writeFile(
            path.join(imagesDir, `${newFile.id}.json`),
            JSON.stringify(newFile, null, 2) // Optional: Pretty print JSON
          );
        } catch (e) {
          console.error(`Failed to write file: ${newFile.id}.json`, e);
        }
      })
    );
  } catch (error) {
    console.error(`Failed to add files process: ${error.message}`);
  }
}

export async function getFiles(idList, activeFolder) {
  const imagesDir = path.join(activeFolder, "images");

  try {
    // 3. Use Promise.all to read files in parallel
    const filePromises = idList.map(async (fileId) => {
      try {
        const fileJson = await fs.readFile(
          path.join(imagesDir, `${fileId}.json`),
          "utf-8" // Fixed: Specify encoding to get string instead of Buffer
        );
        return JSON.parse(fileJson);
      } catch (e) {
        console.error(`Failed to read file: ${fileId}.json`, e);
        return null; // Return null on failure so we can filter later
      }
    });

    const results = await Promise.all(filePromises);

    await deleteUnwantedFiles(
      path.join(activeFolder, "images"),
      idList.map((file) => `${file}.json`)
    );

    // Filter out any nulls from failed reads
    return results.filter((file) => file !== null);
  } catch (error) {
    console.error(`Failed to get files process: ${error.message}`);
    return [];
  }
}

async function deleteUnwantedFiles(folderPath, allowedFiles) {
  try {
    // Read all files from the folder
    const items = await fs.readdir(folderPath);

    // Loop through each file
    for (const item of items) {
      const fullPath = path.join(folderPath, item);

      // If file is not inside the allowed list → delete it
      if (!allowedFiles.includes(item)) {
        await fs.unlink(fullPath);
        // console.log("Deleted:", item);
      }
    }

    // console.log("Cleanup complete!");
  } catch (error) {
    console.error("Error:", error);
  }
}
