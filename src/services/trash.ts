import { fileExists, createDirectory, renameFile, readDirectory, deleteFile, deleteDirectory } from "./fileSystem";
import { FileNode } from "../stores/appStore";

const TRASH_FOLDER_NAME = "_trash";

export function getTrashPath(projectPath: string): string {
  return `${projectPath}/${TRASH_FOLDER_NAME}`;
}

export async function ensureTrashFolder(projectPath: string): Promise<void> {
  const trashPath = getTrashPath(projectPath);
  const exists = await fileExists(trashPath);
  if (!exists) {
    await createDirectory(trashPath);
  }
}

export async function moveToTrash(
  filePath: string,
  projectPath: string
): Promise<void> {
  await ensureTrashFolder(projectPath);
  
  const trashPath = getTrashPath(projectPath);
  const fileName = filePath.split("/").pop() || "unknown";
  
  // Generate unique name if file already exists in trash
  let targetPath = `${trashPath}/${fileName}`;
  let counter = 1;
  
  while (await fileExists(targetPath)) {
    const lastDot = fileName.lastIndexOf(".");
    if (lastDot === -1) {
      targetPath = `${trashPath}/${fileName} (${counter})`;
    } else {
      const name = fileName.substring(0, lastDot);
      const ext = fileName.substring(lastDot);
      targetPath = `${trashPath}/${name} (${counter})${ext}`;
    }
    counter++;
  }
  
  await renameFile(filePath, targetPath);
}

export async function restoreFromTrash(
  trashFilePath: string,
  projectPath: string,
  destinationPath?: string
): Promise<string> {
  const fileName = trashFilePath.split("/").pop() || "unknown";
  
  // Default destination is project root
  const destFolder = destinationPath || projectPath;
  let targetPath = `${destFolder}/${fileName}`;
  
  // Generate unique name if file already exists at destination
  let counter = 1;
  while (await fileExists(targetPath)) {
    const lastDot = fileName.lastIndexOf(".");
    if (lastDot === -1) {
      targetPath = `${destFolder}/${fileName} (wiederhergestellt ${counter})`;
    } else {
      const name = fileName.substring(0, lastDot);
      const ext = fileName.substring(lastDot);
      targetPath = `${destFolder}/${name} (wiederhergestellt ${counter})${ext}`;
    }
    counter++;
  }
  
  await renameFile(trashFilePath, targetPath);
  return targetPath;
}

export async function getTrashContents(projectPath: string): Promise<FileNode[]> {
  const trashPath = getTrashPath(projectPath);
  
  const exists = await fileExists(trashPath);
  if (!exists) {
    return [];
  }
  
  try {
    return await readDirectory(trashPath);
  } catch (error) {
    console.error("Error reading trash folder:", error);
    return [];
  }
}

export async function emptyTrash(projectPath: string): Promise<void> {
  const trashPath = getTrashPath(projectPath);
  
  const exists = await fileExists(trashPath);
  if (!exists) {
    return;
  }
  
  const contents = await getTrashContents(projectPath);
  
  for (const item of contents) {
    try {
      if (item.isDirectory) {
        await deleteDirectory(item.path);
      } else {
        await deleteFile(item.path);
      }
    } catch (error) {
      console.error("Error deleting trash item:", item.path, error);
    }
  }
}

export async function permanentlyDelete(filePath: string, isDirectory: boolean): Promise<void> {
  if (isDirectory) {
    await deleteDirectory(filePath);
  } else {
    await deleteFile(filePath);
  }
}

export function isInTrash(filePath: string, projectPath: string): boolean {
  const trashPath = getTrashPath(projectPath);
  return filePath.startsWith(trashPath);
}

export function isTrashFolder(filePath: string, projectPath: string): boolean {
  const trashPath = getTrashPath(projectPath);
  return filePath === trashPath;
}
