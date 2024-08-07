const { app, BrowserWindow, ipcMain, remote, screen, dialog } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const fsPromises = require('fs').promises;
const fs = require('fs');
let open;

(async () => {
  open = (await import('open')).default;

  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  function createWindow() {
    const mainWindow = new BrowserWindow({
      width: width,
      height: height,
      icon: path.join(__dirname, 'icon.ico'),
      fullscreenable: true,
      maximizable: true,
      closable: true,
      autoHideMenuBar: true,
      darkTheme: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        devTools: true
      },
    });

    mainWindow.loadFile('index.html');

    ipcMain.handle('minimize', event => {
      remote.BrowserWindow.getFocusedWindow().minimize();
    })
    
    ipcMain.handle('maximize', event => {
      const win = remote.BrowserWindow.getFocusedWindow();
      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }  
    })

    ipcMain.handle('close', event => {
      remote.BrowserWindow.getFocusedWindow().close();
    })

    ipcMain.handle('get-directory-content', async (event, dirPath) => {
      try {
        dirPath = dirPath.replace('%username%', process.env.USERNAME || process.env.USER);

        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        const result = entries.map((entry, index) => {
          event.sender.send('operation-progress', Math.round((index + 1) / entries.length * 100));
          
          const fullPath = path.join(dirPath, entry.name);
          return {
            name: entry.name,
            path: entry.parentPath,
            isImage: entry.isFile() && isImage(fullPath),
            isDirectory: entry.isDirectory(),
            isHidden: entry.name.startsWith('.'),
          };
        });

        return result;
      } catch (error) {
        console.error('Error reading directory:', error);
        return [];
      }
    });

    ipcMain.handle('open-file', async (event, filePath) => {
      try {
        event.sender.send('operation-progress', 0);
        await open(filePath);
        event.sender.send('operation-progress', 100);
      } catch (error) {
        console.error(`Failed to open file: ${error.message}`);
      }
    });

    ipcMain.handle('choose-app-to-open-file', async (event, filePath) => {
      try {
        const scriptPath = path.join(__dirname, 'showOpenWith.ps1');
        const escapedFilePath = filePath.replace(/"/g, `"`);
        const command = `powershell -ExecutionPolicy Bypass -File "${scriptPath}" -filePath "${escapedFilePath}"`;
        event.sender.send('operation-progress', 0);

        await exec(command, (error, stdout, stderr) => {
          if (error) {
            console.error(`Error: ${stderr}`);
          } else {
            console.log(`Output: ${stdout}`);
          }
        });
        event.sender.send('operation-progress', 100);
      } catch (error) {
        console.error(`Failed to open file with Open With dialog: ${error.message}`);
      }
    });

    ipcMain.handle('rename-file',async (event, filePath, newName, oldName, isDirectory) => {
      event.sender.send('operation-progress', 0);
      let extension = oldName.split('.').pop();
      extension = '.' + extension;
      extension == '.' ? extension = '' : extension = extension;
      if (isDirectory) extension = '';
      extension = '' //remove if we want to keep the original extension
      const dir = path.dirname(filePath);
      const newFilePath = path.join(dir, newName + extension);
      try {
        await fs.renameSync(filePath, newFilePath);
        event.sender.send('operation-progress', 100);
        return { success: true };
      } catch (error) {
        console.error('Error renaming file:', error);
        return { success: false, title: 'Error renaming file', message: error };
      }
    });

    ipcMain.handle('delete-file',async (event, filePath) => {
      try {
        event.sender.send('operation-progress', 0);
        await fs.unlinkSync(filePath);
        event.sender.send('operation-progress', 100);
        return { success: true };
      } catch (error) {
        console.error('Error deleting file:', error);
        return { success: false, title: 'Error deleting file', message: error };
      }
    });

    ipcMain.handle('mass-delete-file',async (event, filePath) => {
      try {
        await filePath.forEach(async (file, index) => {
          await fs.unlinkSync(file.path);
          event.sender.send('operation-progress', Math.round(((index + 1) / filePath.length) * 100));
        });
        return { success: true };  
      } catch (error) {
        console.error('Error deleting files:', error);
        return { success: false, title: 'Error deleting files', message: error };
      }
    });

    // COPY
    ipcMain.handle('copy-item', async (event, sourcePath, destinationDir) => {
      try {
        const sourceFileName = path.basename(sourcePath);
        let destinationPath = path.join(destinationDir, sourceFileName);

        destinationPath = await getUniqueFileName(destinationPath);

        const stats = await fsPromises.stat(sourcePath);

        if (stats.isDirectory()) {
          await copyFolderAsync(sourcePath, destinationPath, event);
        } else {
          await fsPromises.copyFile(sourcePath, destinationPath);
        }

        event.sender.send('operation-progress', 100);
        return { success: true };
      } catch (error) {
        console.error('Error copying item:', error);
        return { success: false, title: 'Error copying item', message: error.message };
      }
    });

    ipcMain.handle('mass-copy-item', async (event, sourcePath, destinationDir) => {
      try {
        await sourcePath.forEach(async (file, index)=> {
          const sourceFileName = path.basename(file.path);
          let destinationPath = path.join(destinationDir, sourceFileName);
  
          destinationPath = await getUniqueFileName(destinationPath);
  
          const stats = await fsPromises.stat(file.path);
  
          if (stats.isDirectory()) {
            await copyFolderAsync(file.path, destinationPath, event, true);
          } else {
            await fsPromises.copyFile(file.path, destinationPath);
          }
          event.sender.send('operation-progress', Math.round((index + 1) / sourcePath.length) * 100);
        })
        return { success: true };  
      } catch (error) {
        console.error('Error copying item:', error);
        return { success: false, title: 'Error copying item', message: error.message };
      }
    });

    // CUT
    ipcMain.handle('move-item', async (event, sourcePath, destinationDir) => {
      try {
        const sourceFileName = path.basename(sourcePath);
        let destinationPath = path.join(destinationDir, sourceFileName);

        destinationPath = await getUniqueFileName(destinationPath);

        const stats = await fsPromises.stat(sourcePath);

        if (stats.isDirectory()) {
          await moveFolderAsync(sourcePath, destinationPath, event);
        } else {
          await fsPromises.rename(sourcePath, destinationPath);
        }
        event.sender.send('operation-progress', 100);
        return { success: true };
      } catch (error) {
        console.error('Error moving item:', error);
        return { success: false, title: 'Error moving item', message: error.message };
      }
    });

    ipcMain.handle('mass-move-item', async (event, sourcePath, destinationDir) => {
      try {
        await sourcePath.forEach(async (file, index)=> {
          const sourceFileName = path.basename(file.path);
          let destinationPath = path.join(destinationDir, sourceFileName);
        
          destinationPath = await getUniqueFileName(destinationPath);

          const stats = await fsPromises.stat(file.path);

          if (stats.isDirectory()) {
            await moveFolderAsync(file.path, destinationPath, event), true;
          } else {
            await fsPromises.rename(file.path, destinationPath);
          }
          event.sender.send('operation-progress', Math.round((index + 1) / sourcePath.length) * 100);
        })
        return { success: true };
      } catch (error) {
        console.error('Error moving item:', error);
        return { success: false, title: 'Error moving item', message: error.message };
      }
    });

    ipcMain.handle('read-tags', () => {
      try {
        const tagsFilePath = path.join(__dirname, 'tags.json');
        if (fs.existsSync(tagsFilePath)) {
          return JSON.parse(fs.readFileSync(tagsFilePath));
        }
        return {};
      } catch (error) {
        console.error('Error reading tags file:', error);
        return {};
      }
    });
  
    ipcMain.handle('read-recents', () => {
      try {
        const tagsFilePath = path.join(__dirname, 'recents.json');
        if (fs.existsSync(tagsFilePath)) {
          return JSON.parse(fs.readFileSync(tagsFilePath));
        }
        return {};
      } catch (error) {
        console.error('Error reading tags file:', error);
        return {};
      }
    });

    ipcMain.handle('read-settings', () => {
      try {
        const tagsFilePath = path.join(__dirname, 'settings.json');
        if (fs.existsSync(tagsFilePath)) {
          return JSON.parse(fs.readFileSync(tagsFilePath));
        }
        return {};
      } catch (error) {
        console.error('Error reading tags file:', error);
        return {};
      }
    });
    
    ipcMain.handle('write-tags',async (event, tag, color, filePath) => {
      try {
        const tagsFilePath = path.join(__dirname, 'tags.json');
        if (fs.existsSync(tagsFilePath)) {
          let tags = await JSON.parse(fs.readFileSync(tagsFilePath));
          let existingEntry = tags.find(e=> e.tag == tag)
          
          if (existingEntry) {
            existingEntry.files.push(filePath)
          } else {
            tags.push({
              tag: tag,
              color: color,
              files: [filePath]
            });
          }
          fs.writeFileSync(tagsFilePath, JSON.stringify(tags, null, 2));  
        }
        return {success: true}
      } catch (error) {
        return { success: false, title: 'Error writing tags file', message: error.message };
      }
    });

    ipcMain.handle('write-recents',async (event, recents) => {
      try {
        const tagsFilePath = path.join(__dirname, 'recents.json');
        if (fs.existsSync(tagsFilePath)) {
          fs.writeFileSync(tagsFilePath, JSON.stringify(recents, null, 2));  
        }
        return {success: true}
      } catch (error) {
        return { success: false, title: 'Error writing recents file', message: error.message };
      }
    });

    ipcMain.handle('write-settings',async (event, recents) => {
      try {
        const tagsFilePath = path.join(__dirname, 'settings.json');
        if (fs.existsSync(tagsFilePath)) {
          fs.writeFileSync(tagsFilePath, JSON.stringify(recents, null, 2));  
        }
        return {success: true}
      } catch (error) {
        return { success: false, title: 'Error writing settings file', message: error.message };
      }
    });


    ipcMain.handle('mass-write-tags',async (event, tag, color, filePath) => {
      try {
        if (tag.trim() == '') return {success: false, message: 'Tag name cannot be empty'}
        const tagsFilePath = path.join(__dirname, 'tags.json');
        let tags = await JSON.parse(fs.readFileSync(tagsFilePath));
        await filePath.forEach(async (file)=> {
          if (fs.existsSync(tagsFilePath)) {
            let existingEntry = tags.find(e=> e.tag == tag)
            
            if (existingEntry) {
              existingEntry.files.push(file.path)
            } else {
              tags.push({
                tag: tag,
                color: color,
                files: [file.path]
              });
            }
          }  
        })
        fs.writeFileSync(tagsFilePath, JSON.stringify(tags, null, 2));  
        return {success: true}
      } catch (error) {
        return { success: false, title: 'Error writing tags file', message: error.message };
      }
    });

    ipcMain.handle('get-file-properties', async (event, filePath) => {
      try {
        const stats = await fsPromises.stat(filePath);
        const tagsFilePath = path.join(__dirname, 'tags.json');
        let tags = [];
        if (fs.existsSync(tagsFilePath)) {
          const allTags = JSON.parse(fs.readFileSync(tagsFilePath));
          const fileTags = allTags.filter(tag => tag.files.includes(filePath));
          tags = fileTags.map(tag => ({ name: tag.tag, color: tag.color }));
        }
    
        const type = path.extname(filePath) ? `File(${path.extname(filePath)})` : 'File'
        return {
          name: path.basename(filePath),
          path: filePath,
          size: stats.size,
          type: stats.isDirectory() ? 'Directory' : type,
          modified: stats.mtime.toLocaleString(),
          tags: tags,
          created: stats.birthtime
        };
      } catch (error) {
        console.error('Error getting file properties:', error);
        throw error;
      }
    });  
    
    ipcMain.handle('dialog:openDirectory', async () => {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory']
      });
      return result.filePaths[0]; // Return the full path of the selected directory
    });  
  }

  function isImage(filePath) {
    const imageExtensions = [
      '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp',
      '.heif', '.heic', '.raw', '.svg', '.ico', '.jfif', '.exif',
    ];
    return imageExtensions.includes(path.extname(filePath).toLowerCase());
  }

  async function getUniqueFileName(filePath) {
    let fileName = path.basename(filePath, path.extname(filePath));
    let fileExt = path.extname(filePath);
    let uniqueFilePath = filePath;
    let count = 1;

    while (await fsPromises.access(uniqueFilePath).then(() => true).catch(() => false)) {
      uniqueFilePath = path.join(path.dirname(filePath), `${fileName} - copy (${count})${fileExt}`);
      count++;
    }

    return uniqueFilePath;
  }

  async function copyFolderAsync(src, dest, event, mass = false) {
    await fsPromises.mkdir(dest, { recursive: true });

    const items = await fsPromises.readdir(src);

    let totalItems = items.length;
    let completedItems = 0;

    for (let item of items) {
      const srcPath = path.join(src, item);
      const destPath = path.join(dest, item);

      const stats = await fsPromises.stat(srcPath);

      if (stats.isDirectory()) {
        await copyFolderAsync(srcPath, destPath, event, mass);
      } else {
        await fsPromises.copyFile(srcPath, destPath);
      }

      completedItems++;
      !mass ? event.sender.send('operation-progress', Math.round((completedItems / totalItems) * 100)) : ''
    }
  }

  async function moveFolderAsync(src, dest, event, mass=false) {
    await copyFolderAsync(src, dest, event, mass);
    await fsPromises.rm(src, { recursive: true, force: true });
  }

  app.whenReady().then(createWindow);

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
})();
