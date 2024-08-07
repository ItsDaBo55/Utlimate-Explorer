const fileView = document.getElementById('file-view');

let currentPath = 'C:/';
let previousPath = 'C:/';
let openedDirectories = [currentPath];
let copiedItem = {};
let isCut = false;
let cutFile = 'null';
let selectedFile = 'null';
let selectedFileIsDir = false;
let initialSelectionId = null;
let isShiftDown = false;
let massSelectFile = null;
let massCut = false;
let massCopiedItems = [{ path: 'null' }];
let currentColor = '#fff';
let pickedTag = null;
let fileTags = [];
let hasTags = [{}];
let recents = ['C:/']
let settings = {homeButton: "C:/", landingPage: 'C:/'}

function normalizePath(path) {
  return path.replace(/\\/g, '/').replace('//', '/'); // Replace all backslashes with forward slashes
}

function getLastDir(path) {
  // Normalize path separators
  const normalizedPath = path.replace(/\\/g, '/'); // Convert backslashes to slashes
  const parts = normalizedPath.split('/'); // Split by '/'
  return parts.pop(); // Get the last element
}

function loadTags() {
  hasTags = [];
  pickedTag = null;
  const tagMenu = document.querySelector('.dropdown-menu');
  document.querySelector('#dropdownMenuButton').innerHTML = 'Pick Tag';
  tagMenu.innerHTML = '';
  fileTags.forEach(tag => {
    tag.files.forEach(file => {
      let normalizedFilePath = normalizePath(file);
      let existingEntry = hasTags.find(e => normalizePath(e.path) === normalizedFilePath);
      if (existingEntry) {
        existingEntry.tags.push({ tagName: tag.tag, tagColor: tag.color });
      } else {
        hasTags.push({
          path: normalizedFilePath, // Use normalized path
          tags: [{ tagName: tag.tag, tagColor: tag.color }]
        });
      }
    });
    const tagEle = document.createElement('div');
    tagEle.value = tag.tag;
    tagEle.className = 'dropdown-item';
    tagEle.textContent = tag.tag;
    tagEle.onclick = () => {
      tagEle.onclick = () => { return; }
      pickedTag = tag;
      document.querySelector('#dropdownMenuButton').innerHTML = 'Tag: '
      document.querySelector('#dropdownMenuButton').style.breakAfter = '';
      const tagReEle = document.createElement('div');
      tagReEle.innerHTML = 'X';
      tagReEle.style.marginLeft = '50px';
      tagReEle.onclick = () => {
        loadTags();
      }
      tagEle.appendChild(tagReEle);
      document.querySelector('#dropdownMenuButton').appendChild(tagEle);
    }

    const tagColorEle = document.createElement('div');
    tagColorEle.className = 'tag-color';
    tagColorEle.style.backgroundColor = tag.color;

    tagEle.appendChild(tagColorEle);
    tagMenu.appendChild(tagEle);
  });
}

function loadSettings() {
  currentPath = settings.landingPage
  document.querySelector('#homeButton').setAttribute('data-path', settings.homeButton)
  document.getElementById('landingPageLabel').textContent = `${normalizePath(settings.landingPage)}`;
  document.getElementById('homeButtonLabel').textContent = `${normalizePath(settings.homeButton)}`;

}

function loadAndSaveRecents() {
  document.querySelector('#recents').innerHTML = ''
  const pathCount = {};

  recents.forEach(path => {
    path = normalizePath(path);
    pathCount[path] = (pathCount[path] || 0) + 1;
  });

  const pathEntries = Object.entries(pathCount);

  pathEntries.sort((a, b) => b[1] - a[1]);

  const top4Path = pathEntries.slice(0, 3);

  top4Path.forEach(path=> {
    const pathEl = document.createElement('li')
    pathEl.className = "menu-item"
    pathEl.setAttribute('data-path', normalizePath(path[0]))
    pathEl.setAttribute('data-isDir', true)
    pathEl.onclick = () => {
      loadDirectory(normalizePath(path[0]))
    }
    if (hasTags.find(e => e.path == normalizePath(path[0]))) {
      let allFileTags = hasTags.find(e => e.path == normalizePath(path[0]));
      pathEl.innerHTML += getLastDir(normalizePath(path[0])).length > 15 ? `${getLastDir(normalizePath(path[0])).substring(0, 12)}...` : getLastDir(normalizePath(path[0]));
      const tagsContainer = document.createElement('div');
      tagsContainer.className = 'tags-container';
      pathEl.innerHTML = `<i class="icon">📂</i><span>${getLastDir(normalizePath(path[0])).length > 15 ? getLastDir(normalizePath(path[0])).substring(0, 12) + '...' : (getLastDir(normalizePath(path[0])) ? getLastDir(normalizePath(path[0])) : 'C:/')}</span>`
      pathEl.appendChild(tagsContainer);
      allFileTags.tags.forEach(tag => {
        const tagEl = document.createElement('div');
        tagEl.className = 'tag-color';
        tagEl.style.backgroundColor = tag.tagColor;
        tagEl.style.marginLeft = '0px !important';
        tagEl.title = tag.tagName;
        tagsContainer.appendChild(tagEl);
      });
    } else {
      pathEl.innerHTML = `<i class="icon">📂</i><span>${getLastDir(normalizePath(path[0])).length > 15 ? getLastDir(normalizePath(path[0])).substring(0, 12) + '...' : (getLastDir(normalizePath(path[0])) ? getLastDir(normalizePath(path[0])) : 'C:/')}</span>`
    }
    document.querySelector('#recents').appendChild(pathEl)
  })

  window.electronAPI.writeRecents(recents).catch((error) => {
    console.error('Error writing recents:', error);
  })
}

window.electronAPI.readTags().then(async(tags) => {
  fileTags = tags;
  await loadTags();
  window.electronAPI.readRecents().then(async(recent) => {
    recents = recent;
    await loadAndSaveRecents()
    window.electronAPI.readSettings().then(async(setting) => {
      settings = setting;
      await loadSettings()
      loadDirectory(settings.landingPage);
    }).catch((error) => {
      console.error('Error reading settings:', error);
    });
  }).catch((error) => {
    console.error('Error reading recents:', error);
  });
}).catch((error) => {
  console.error('Error reading tags:', error);
});


function createContextMenu(event, filePath, isDirectory, fileName, id) {
  const tempMass = massSelectFile;
  const selectedFile = document.querySelectorAll('.file-select');
  const pre = document.querySelector('.context-menu');
  if (pre) {
    pre.remove();
  }
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.top = `${event.clientY}px`;
  menu.style.left = `${event.clientX}px`;

  const openOption = document.createElement('div');
  openOption.textContent = 'Open';
  openOption.onclick = () => {
    if (isDirectory) {
      loadDirectory(filePath);
    } else {
      const noti = createNotification('Opening...');
      window.electronAPI.openFile(filePath).then(() => {
        setTimeout(() => removeNotification(noti), 500);
      }).catch((error) => {
        showCustomAlert('Error opening file:', error);
      });
    }
  };

  const editOption = document.createElement('div');
  editOption.textContent = 'Open With';
  editOption.onclick = async () => {
    const noti = createNotification('Opening...');
    window.electronAPI.editFile(filePath).then(() => {
      setTimeout(() => removeNotification(noti), 500);
    }).catch((error) => {
      showCustomAlert('Error opening file:', error);
    });
  };

  const renameOption = document.createElement('div');
  renameOption.textContent = 'Rename';
  renameOption.onclick = () => showCustomPromptRename('Rename File', 'Enter new name:', (newName, oldName, isDirectory) => renameFile(filePath, newName, oldName, isDirectory), fileName, isDirectory);

  const deleteOption = document.createElement('div');
  deleteOption.textContent = 'Delete';
  deleteOption.onclick = () => {
    if (!Array.isArray(tempMass)) {
      showCustomAlert('Delete File', `Are you sure you want to delete this file? <br> ${fileName}`, () => deleteFile(filePath));
    } else {
      showCustomAlert('Delete Files', `Are you sure you want to delete these files? <br> ${tempMass.map((file, index) => `${index + 1}. ${file.name}`).join('<br>')}`, () => deleteFile(tempMass));
    }
  };

  const copyOption = document.createElement('div');
  copyOption.textContent = 'Copy';
  copyOption.onclick = () => {
    if (Array.isArray(tempMass)) {
      const noti = createNotification('Copied Items', 100);
      if (document.querySelector('.cut') != null) {
        document.querySelectorAll('.cut').forEach(i => i.classList.remove('cut'));
      }
      setTimeout(() => removeNotification(noti), 500);
      massCopiedItems = [];
      tempMass.forEach(file => {
        massCopiedItems.push({ path: file.path, isDirectory: file.isDirectory });
      });
      isCut = false;
      massCut = false;
    } else {
      const noti = createNotification('Copied Item', 100);
      if (document.querySelector('.cut') != null) {
        document.querySelectorAll('.cut').forEach(i => i.classList.remove('cut'));
      }
      setTimeout(() => removeNotification(noti), 500);
      copiedItem = { filePath, isDirectory };
      isCut = false;
      massCut = false;
    }
  };

  const cutOption = document.createElement('div');
  cutOption.textContent = 'Cut';
  cutOption.onclick = () => {
    if (Array.isArray(tempMass)) {
      const noti = createNotification('Cut Items', 100);
      if (document.querySelector('.cut') != null) {
        document.querySelectorAll('.cut').forEach(i => i.classList.remove('cut'));
      }
      selectedFile.forEach(file => {
        file.classList.add('cut');
      });
      setTimeout(() => removeNotification(noti), 500);
      massCopiedItems = [];
      tempMass.forEach(file => {
        massCopiedItems.push({ path: file.path, isDirectory: file.isDirectory });
      });
      massCut = true;
      isCut = true;
    } else {
      const noti = createNotification('Cut Item', 100);
      if (document.querySelector('.cut') != null) {
        document.querySelectorAll('.cut').forEach(i => i.classList.remove('cut'));
      }
      document.getElementById(id).classList.add('cut');
      cutFile = filePath;
      setTimeout(() => removeNotification(noti), 500);
      copiedItem = { filePath, isDirectory };
      isCut = true;
      massCut = false;
    }
  };

  const pasteOption = document.createElement('div');
  pasteOption.textContent = 'Paste';
  if (!copiedItem.filePath && massCopiedItems[0].path == 'null') {
    pasteOption.disabled = true;
    pasteOption.classList.add('disabled');
  } else {
    pasteOption.onclick = async () => {
      const noti = createNotification(isCut ? 'Moving file...' : 'Copying file...');
      if (isCut) {
        if (massCopiedItems[0].path == 'null') {
          window.electronAPI.moveItem(copiedItem.filePath, currentPath).then((data) => {
            if (!data.success) {
              showCustomAlert(data.title, data.message);
              return;
            }
            loadDirectory(currentPath);
            setTimeout(() => removeNotification(noti), 500);
          }).catch((error) => {
            showCustomAlert('Error moving item:', error);
          });
          copiedItem = { filePath: null };
          massCopiedItems = [{ path: 'null' }];
          isCut = false;
          massCut = false;
        } else {
          window.electronAPI.massMoveItem(massCopiedItems, currentPath).then((data) => {
            if (!data.success) {
              showCustomAlert(data.title, data.message);
              return;
            }
            loadDirectory(currentPath);
            setTimeout(() => removeNotification(noti), 500);
          }).catch((error) => {
            showCustomAlert('Error moving item:', error);
          });
          copiedItem = { filePath: null };
          massCopiedItems = [{ path: 'null' }];
          isCut = false;
          massCut = false;
        }
      } else {
        if (massCopiedItems[0].path == 'null') {
          window.electronAPI.copyItem(copiedItem.filePath, currentPath).then((data) => {
            if (!data.success) {
              showCustomAlert(data.title, data.message);
              return;
            }
            loadDirectory(currentPath);
            setTimeout(() => removeNotification(noti), 500);
          }).catch((error) => {
            showCustomAlert('Error copying item:', error);
          });
        } else {
          window.electronAPI.massCopyItem(massCopiedItems, currentPath).then((data) => {
            if (!data.success) {
              showCustomAlert(data.title, data.message);
              return;
            }
            loadDirectory(currentPath);
            setTimeout(() => removeNotification(noti), 500);
          }).catch((error) => {
            showCustomAlert('Error copying item:', error);
          });
        }
      }
      copiedItem = { filePath: null };
      massCopiedItems = [{ path: 'null' }];
      isCut = false;
      massCut = false;
      massSelectFile = null;
    };
  }

  const tagOption = document.createElement('div');
  tagOption.textContent = 'Add Tag';
  tagOption.onclick = () => {
    if (!Array.isArray(tempMass)) {
      showCustomPromptAddTag('Add Tag', 'Enter tag name:', (tagName, tagColor) => addTag(filePath, tagName, tagColor));
    } else {
      showCustomPromptAddTag('Add Tag', 'Enter tag name:', (tagName, tagColor) => addTag(tempMass, tagName, tagColor));
    }
  }

  const propertiesOption = document.createElement('div');
  propertiesOption.textContent = 'Properties';
  propertiesOption.onclick = () => {
    showPropertiesModal(filePath);
  };
  

  massSelectFile == null ? menu.appendChild(openOption) : '';
  !isDirectory && massSelectFile == null ? menu.appendChild(editOption) : '';
  massSelectFile == null ? menu.appendChild(renameOption) : '';
  menu.appendChild(deleteOption);
  menu.appendChild(copyOption);
  menu.appendChild(cutOption);
  copiedItem.filePath || massCopiedItems[0].path != 'null' ? menu.appendChild(pasteOption) : '';
  menu.appendChild(tagOption);
  massSelectFile == null ? menu.appendChild(propertiesOption) : '';
  document.body.appendChild(menu);

  const removeMenu = () => {
    if (menu) {
      document.body.removeChild(menu);
      document.removeEventListener('click', removeMenu);
    }
  };

  setTimeout(() => window.addEventListener('click', removeMenu), 0);
}

async function loadDirectory(path) {
  const noti = createNotification('Loading...');
  const pathParts = normalizePath(path).split('/');
  previousPath = pathParts.slice(0, pathParts.length - 1).join('/') == 'C:' ? 'C:/' : pathParts.slice(0, pathParts.length - 1).join('/');
  currentPath = normalizePath(path);
  recents.push(normalizePath(path))
  loadAndSaveRecents()
  window.electronAPI.readDirectory(path).then((files) => {
    fileView.innerHTML = '';
    if (currentPath != 'C:/') {
      const fileItem = document.createElement('div');
      const fileId = Math.floor(Math.random() * 1e10);
      fileItem.className = 'file-item ' + fileId;
      fileItem.title = '...';
      fileItem.id = fileId;
      fileItem.setAttribute('data-path', 'back');
      // fileItem.onclick = () => selectFile(fileItem.id);

      const imgCont = document.createElement('div');
      imgCont.className = 'file-item-img-cont';

      const img = document.createElement('img');
      img.src = './back.png';
      imgCont.appendChild(img);
      fileItem.appendChild(imgCont);
      fileItem.ondblclick = () => loadDirectory(previousPath);

      fileItem.innerHTML += '...';

      fileView.appendChild(fileItem);
    }

    files.forEach((file) => {
      const fileItem = document.createElement('div');
      const fileId = Math.floor(Math.random() * 1e10);
      fileItem.setAttribute('data-path', (normalizePath(file.path) == 'C:/' ? normalizePath(file.path) + file.name : normalizePath(file.path) + '/' + file.name))
      fileItem.setAttribute('data-isDir', file.isDirectory);
      fileItem.className = 'file-item ' + fileId;
      if (normalizePath(cutFile) == (normalizePath(file.path) == 'C:/' ? normalizePath(file.path) + file.name : normalizePath(file.path) + '/' + file.name)) {
        fileItem.classList.add('cut');
      }
      if (massCut && massCopiedItems.find(i => normalizePath(i.path) == (normalizePath(file.path) == 'C:/' ? normalizePath(file.path) + file.name : normalizePath(file.path) + '/' + file.name))) {
        fileItem.classList.add('cut');
      }
      fileItem.title = file.name;
      fileItem.id = fileId;
      // fileItem.onclick = () => selectFile(fileItem.id, (normalizePath(file.path) == 'C:/' ? normalizePath(file.path) + file.name : normalizePath(file.path) + '/' + file.name), file.isDirectory);
      fileItem.oncontextmenu = (e) => {
        e.preventDefault();
        createContextMenu(e, (normalizePath(file.path) == 'C:/' ? normalizePath(file.path) + file.name : normalizePath(file.path) + '/' + file.name), file.isDirectory, file.name, fileId);
      };
      if (file.isImage) {
        const imgCont = document.createElement('div');
        imgCont.className = 'file-item-img-cont';

        const img = document.createElement('img');
        img.src = getFileThumbnail(file);
        imgCont.appendChild(img);
        fileItem.appendChild(imgCont);

        fileItem.ondblclick = async () => {
          const noti = createNotification('Opening...');
          window.electronAPI.openFile((normalizePath(file.path) == 'C:/' ? normalizePath(file.path) + file.name : normalizePath(file.path) + '/' + file.name)).then(() => {
            setTimeout(() => removeNotification(noti), 500);
          }).catch((error) => {
            showCustomAlert('Error opening file:', error);
          });
        };
      } else if (file.isDirectory) {
        const imgCont = document.createElement('div');
        imgCont.className = 'file-item-img-cont';

        const img = document.createElement('img');
        img.src = './folder.png';
        imgCont.appendChild(img);
        fileItem.appendChild(imgCont);

        fileItem.ondblclick = async () => {
          const noti = createNotification('Loading...');
          loadDirectory((normalizePath(file.path) == 'C:/' ? normalizePath(file.path) + file.name : normalizePath(file.path) + '/' + file.name)).then(() => {
            setTimeout(() => removeNotification(noti), 100);
          });
        };
      } else {
        const imgCont = document.createElement('div');
        imgCont.className = 'file-item-img-cont';

        const img = document.createElement('img');
        img.src = './file.png';
        imgCont.appendChild(img);
        fileItem.appendChild(imgCont);
        fileItem.ondblclick = async () => {
          const noti = createNotification('Opening...');
          window.electronAPI.openFile((normalizePath(file.path) == 'C:/' ? normalizePath(file.path) + file.name : normalizePath(file.path) + '/' + file.name)).then(() => {
            setTimeout(() => removeNotification(noti), 500);
          }).catch((error) => {
            showCustomAlert('Error opening file:', error);
          });
        };
      }
      if (hasTags.find(e => e.path == (normalizePath(file.path) == 'C:/' ? normalizePath(file.path) + file.name : normalizePath(file.path) + '/' + file.name))) {
        let allFileTags = hasTags.find(e => e.path == (normalizePath(file.path) == 'C:/' ? normalizePath(file.path) + file.name : normalizePath(file.path) + '/' + file.name));
        fileItem.innerHTML += file.name.length > 15 ? `${file.name.substring(0, 12)}...` : file.name;
        const tagsContainer = document.createElement('div');
        tagsContainer.className = 'tags-container';
        fileItem.appendChild(tagsContainer);
        allFileTags.tags.forEach(tag => {
          const tagEl = document.createElement('div');
          tagEl.className = 'tag-color';
          tagEl.style.backgroundColor = tag.tagColor;
          tagEl.style.marginLeft = '0px !important';
          tagEl.title = tag.tagName;

          tagsContainer.appendChild(tagEl);
        });
      } else {
        fileItem.innerHTML += file.name.length > 15 ? `${file.name.substring(0, 12)}...` : file.name;
      }

      fileView.appendChild(fileItem);
    });
    fileView.scrollTop = -fileView.scrollHeight;
    setTimeout(() => removeNotification(noti), 500);
  }).catch((error) => {
    showCustomAlert('Error reading directory:', error);
    setTimeout(() => removeNotification(noti), 500);
  });
}

function selectFile(id, filePath = 'null', isDirectory = false, shiftKey = false) {
  if (shiftKey && initialSelectionId == null) {
    // Select all files between the start and current selection
    const fileItems = document.querySelectorAll('.file-item');
    let inRange = false;
    massSelectFile = [];
    fileItems.forEach(item => {
      if (item.id === initialSelectionId || item.id === id) {
        inRange = !inRange;
        item.classList.add('file-select');
        item.getAttribute('data-path') != 'back' ? massSelectFile.push({ name: item.title, path: item.getAttribute('data-path'), isDirectory: item.getAttribute('isDir') }) : '';
        return;
      }
      if (!inRange) {
        item.classList.add('file-select');
        item.getAttribute('data-path') != 'back' ? massSelectFile.push({ name: item.title, path: item.getAttribute('data-path'), isDirectory: item.getAttribute('isDir') }) : '';
      }
    });
  } else if (shiftKey && initialSelectionId != null) {
    function getFileIndex(id) {
      const fileItems = Array.from(document.querySelectorAll('.file-item'));
      return fileItems.findIndex(item => item.id === id);
    }
    const fileItems = Array.from(document.querySelectorAll('.file-item'));
    const initialIndex = getFileIndex(initialSelectionId);
    const currentIndex = getFileIndex(id);
    massSelectFile = [];
    if (initialIndex !== -1 && currentIndex !== -1) {
      const start = Math.min(initialIndex, currentIndex);
      const end = Math.max(initialIndex, currentIndex);

      fileItems.forEach((item, index) => {
        if (index >= start && index <= end) {
          item.classList.add('file-select');
          item.getAttribute('data-path') != 'back' ? massSelectFile.push({ name: item.title, path: item.getAttribute('data-path'), isDirectory: item.getAttribute('isDir') }) : '';
        }
      });
    }
  } else {
    // Regular single file selection
    deselectAllFiles();
    const selectedItem = document.getElementById(id);
    selectedItem.classList.add('file-select');
    const pre = document.querySelector('.file-select');
    initialSelectionId = id;
    if (pre) {
      pre.classList.remove('file-select');
    }
    document.getElementById(id).classList.add('file-select');
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.file-select')) {
        deselectFile();
      }
    });
  }
  selectedFile = normalizePath(filePath);
  selectedFileIsDir = isDirectory;
}

fileView.addEventListener('click', (e) => {
  if (e.shiftKey) {
    isShiftDown = true;
  }
  const id = e.target.closest('.file-item')?.id;
  if (id) {
    selectFile(id, e.target.closest('.file-item')?.getAttribute('data-path'), e.target.closest('.file-item')?.getAttribute('data-isDir'), isShiftDown);
  }
  isShiftDown = false; // Reset after the click
});

function deselectAllFiles() {
  massSelectFile = null;
  const selectedItems = document.querySelectorAll('.file-select');
  selectedItems.forEach(item => {
    item.classList.remove('file-select');
  });
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Shift') {
    isShiftDown = true;
  }
});

document.addEventListener('keyup', (event) => {
  if (event.key === 'Shift') {
    isShiftDown = false;
  }
});

function deselectFile() {
  initialSelectionId = null;
  massSelectFile = null;
  const pre = document.querySelector('.file-select');

  if (pre) {
    pre.classList.remove('file-select');
  }
  document.removeEventListener('click', (e) => {
    if (!e.target.closest('.file-select')) {
      deselectFile();
    }
  });
}

function getFileThumbnail(file) {
  const imageTypes = [
    'jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'webp',
    'heif', 'heic', 'raw', 'svg', 'ico', 'jfif', 'exif',
  ];
  const extension = file.name.split('.').pop().toLowerCase();
  if (imageTypes.includes(extension)) {
    file.path = normalizePath(file.path);
    return "file:///" + file.path + '/' + file.name;
  }
  return './file.png';
}

function showCustomPromptRename(title, message, callback, oldName = Math.floor(Math.random() * 1e10), isDirectory = false) {
  const modal = $('#customPromptModal');
  $('#customPromptLabel').text(title);
  $('#customPromptMessage')[0].innerText = message;
  $('#customPromptInput').val(oldName);
  $('#customPromptConfirm').off('click').on('click', () => {
    const input = $('#customPromptInput').val();
    callback(input.trim(), oldName, isDirectory);
    modal.modal('hide');
  });
  modal.modal('show');
}

function showCustomPromptAddTag(title, message, callback) {
  const modal = $('#customPromptModalTag');
  $('#customPromptLabelTag').text(title);
  $('#customPromptConfirmTag').off('click').on('click', () => {
    const input = $('#customPromptInputTag').val();
    callback(input.trim(), $('#customPromptColorTag').val());
    modal.modal('hide');
  });
  modal.modal('show');
}

function showCustomPromptSettings(title, callback) {
  const modal = $('#settingsModal');
  $('#pathModalLabel').text(title);
  $('#confirmSettings').off('click').on('click', () => {
    const homeButtonInput = $('#homeButtonLabel')[0].textContent;
    const landingPageInput = $('#landingPageLabel')[0].textContent;
    callback(homeButtonInput.trim(), landingPageInput.trim());
    modal.modal('hide');
  });
  modal.modal('show');
}

document.querySelector('#customPromptInputTag').addEventListener('input', (e) => {
  const val = e.target.value.trim();
  if (val != '') {
    document.querySelector('.tag-input-error').style.color = '#bd2f2f';
    if (fileTags.find(t => t.tag == val)) {
      $('.tag-input-error').text(`The tag name "${val}" already exists!`);
    } else {
      $('.tag-input-error').text('Looks good!');
      document.querySelector('.tag-input-error').style.color = 'lime';
    }
  } else {
    if (pickedTag != null)
      document.querySelector('.tag-input-error').style.color = '#bd2f2f';
    $('.tag-input-error').text('Tag name cannot be empty!');
  }
});

document.querySelector('#customPromptInput').addEventListener('input', (e) => {
  const val = e.target.value.trim();
  if (val != '') {
    $('.rename-input-error').text('Looks good!');
    document.querySelector('.rename-input-error').style.color = 'lime';
  } else {
    document.querySelector('.rename-input-error').style.color = '#bd2f2f';
    $('.rename-input-error').text('Name cannot be empty!');
  }
});

async function addTag(filePath, tagName, tagColor) {
  if (Array.isArray(filePath)) {
    filePath.forEach(file => {
      if (hasTags.find(e => e.path == file.path) && hasTags.find(e => e.path == file.path).tags.find(t => t.tagName == (tagName ? tagName : pickedTag.tag))) return showCustomAlert('Invalid Tag', `A file already has the tag "${tagName ? tagName : pickedTag.tag}"!`);
    });
  } else {
    if (hasTags.find(e => e.path == filePath) && hasTags.find(e => e.path == filePath).tags.find(t => t.tagName == (tagName ? tagName : pickedTag.tag))) return showCustomAlert('Invalid Tag', `This file already has the tag "${tagName ? tagName : pickedTag.tag}"!`);
  }
  if (pickedTag != null) {
    if (Array.isArray(filePath)) {
      const noti = createNotification('Tagging items');
      await window.electronAPI.massWriteTags(pickedTag.tag, pickedTag.color, filePath).then((data) => {
        if (!data.success) {
          showCustomAlert(data.title, data.message);
          return;
        }
        let findTag = fileTags.find(e => e.tag == pickedTag.tag);
        filePath.forEach(file => {
          findTag.files.push(file.path);
        });
        setTimeout(() => removeNotification(noti), 500);
        loadTags();
        loadDirectory(currentPath);
      }).catch((error) => {
        showCustomAlert(('Error tagging file:', error));
      });
    } else {
      const noti = createNotification('Tagging item', 100);
      await window.electronAPI.writeTags(pickedTag.tag, pickedTag.color, filePath).then((data) => {
        if (!data.success) {
          showCustomAlert(data.title, data.message);
          return;
        }
        let findTag = fileTags.find(e => e.tag == pickedTag.tag);
        findTag.files.push(filePath);
        setTimeout(() => removeNotification(noti), 500);
        loadTags();
        loadDirectory(currentPath);
      }).catch((error) => {
        showCustomAlert(('Error tagging file:', error));
      });
    }
    document.querySelector('.tag-input-error').innerText = '';
    pickedTag = null;
    return;
  } else {
    if (fileTags.find(e => e.tag == tagName)) return showCustomAlert('Invalid Tag', `The tag name "${tagName}" already exists!`);
    if (Array.isArray(filePath)) {
      const noti = createNotification('Tagging items');
      window.electronAPI.massWriteTags(tagName, tagColor, filePath).then(async (data) => {
        if (!data.success) {
          showCustomAlert(data.title, data.message);
          return;
        }
        let obj = {
          tag: tagName,
          color: tagColor,
          files: []
        };
        await filePath.forEach(file => {
          obj.files.push(file.path);
        });
        fileTags.push(obj);
        setTimeout(() => removeNotification(noti), 500);
        loadTags();
        loadDirectory(currentPath);
      }).catch((error) => {
        showCustomAlert(('Error tagging file:', error));
      });
    } else {
      const noti = createNotification('Tagging item', 100);
      window.electronAPI.writeTags(tagName, tagColor, filePath).then((data) => {
        if (!data.success) {
          showCustomAlert(data.title, data.message);
          return;
        }
        fileTags.push({ tag: tagName, color: tagColor, files: [filePath] });
        setTimeout(() => removeNotification(noti), 500);
        loadTags();
        loadDirectory(currentPath);
      }).catch((error) => {
        showCustomAlert(('Error tagging file:', error));
      });
    }
    pickedTag = null;
    document.querySelector('#customPromptInputTag').value = '';
    document.querySelector('.tag-input-error').innerText = '';
    return;
  }
}

function showCustomAlert(title, message, callback = () => { return false; }) {
  const modal = $('#customAlertModal');
  $('#customAlertLabel').text(title);
  $('#customAlertMessage')[0].innerHTML = message;
  $('#customAlertInput').val('');
  $('#customAlertConfirm').off('click').on('click', () => {
    callback();
    modal.modal('hide');
  });
  modal.modal('show');
}

$('#customPromptColorTag').on('input', function () {
  currentColor = this.value;
});

function dropdown() {
  document.querySelector('.dropdown-menu').classList.toggle('show');
  document.querySelector('.dropdown-menu').classList.toggle('hidden');
}

function renameFile(filePath, newName, oldName, isDirectory) {
  if (newName.length <= 0) return showCustomAlert('Rename Failed', 'Name cannot be empty!');
  const noti = createNotification('Renaming item');
  window.electronAPI.renameFile(filePath, newName, oldName, isDirectory).then((data) => {
    if (!data.success) {
      showCustomAlert(data.title, data.message);
      return;
    }
    setTimeout(() => removeNotification(noti), 500);
    loadDirectory(currentPath);
  }).catch((error) => {
    showCustomAlert(('Error renaming file:', error));
  });
  document.querySelector('.rename-input-error').innerText = '';
}

function deleteFile(filePath) {
  if (Array.isArray(filePath)) {
    const noti = createNotification('Deleting items');
    window.electronAPI.massDeleteFile(filePath).then((data) => {
      if (!data.success) {
        showCustomAlert(data.title, data.message);
        return;
      }
      setTimeout(() => removeNotification(noti), 500);
      loadDirectory(currentPath);
    }).catch((error) => {
      showCustomAlert(('Error deleting files:', error));
    });
  } else {
    const noti = createNotification('Deleting item');
    window.electronAPI.deleteFile(filePath).then((data) => {
      if (!data.success) {
        showCustomAlert(data.title, data.message);
        return;
      }
      setTimeout(() => removeNotification(noti), 500);
      loadDirectory(currentPath);
    }).catch((error) => {
      showCustomAlert(('Error deleting file:', error));
    });
  }
}

document.addEventListener('keydown', function (event) {
  if (event.ctrlKey && (event.key === 'C' || event.key === 'c')) {
    if ((selectedFile == 'null' || selectedFile == null) && !Array.isArray(massSelectFile)) return false;
    if (Array.isArray(massSelectFile)) {
      const noti = createNotification('Copied Items', 100);
      if (document.querySelector('.cut') != null) {
        document.querySelectorAll('.cut').forEach(i => i.classList.remove('cut'));
      }
      setTimeout(() => removeNotification(noti), 500);
      massCopiedItems = [];
      massSelectFile.forEach(file => {
        massCopiedItems.push({ path: file.path, isDirectory: file.isDirectory });
      });
      isCut = false;
      massCut = false;
    } else {
      const noti = createNotification('Copied Item', 100);
      if (document.querySelector('.cut') != null) {
        document.querySelectorAll('.cut').forEach(i => i.classList.remove('cut'));
      }
      setTimeout(() => removeNotification(noti), 500);
      copiedItem = { filePath: selectedFile, isDirectory: selectedFileIsDir };
      isCut = false;
      massCut = false;
    }
  } else if (event.ctrlKey && (event.key === 'X' || event.key === 'x')) {
    if ((selectedFile == 'null' || selectedFile == null) && !Array.isArray(massSelectFile)) return false;
    if (Array.isArray(massSelectFile)) {
      const noti = createNotification('Cut Items', 100);
      if (document.querySelector('.cut') != null) {
        document.querySelectorAll('.cut').forEach(i => i.classList.remove('cut'));
      }
      const selectedFile = document.querySelectorAll('.file-select');
      selectedFile.forEach(file => {
        file.classList.add('cut');
      });
      setTimeout(() => removeNotification(noti), 500);
      massCopiedItems = [];
      massSelectFile.forEach(file => {
        massCopiedItems.push({ path: file.path, isDirectory: file.isDirectory });
      });
      massCut = true;
      isCut = true;
    } else {
      const noti = createNotification('Cut Item', 100);
      if (document.querySelector('.cut') != null) {
        document.querySelectorAll('.cut').forEach(i => i.classList.remove('cut'));
      }
      if (document.querySelector('.file-select')) {
        document.querySelector('.file-select').classList.add('cut');
      }
      cutFile = selectedFile;
      setTimeout(() => removeNotification(noti), 500);
      copiedItem = { filePath: selectedFile, isDirectory: selectedFileIsDir };
      isCut = true;
      massCut = false;
    }
  } else if (event.ctrlKey && (event.key === 'V' || event.key === 'v')) {
    if ((selectedFile == 'null' || selectedFile == null) && !Array.isArray(massSelectFile)) return false;
    const noti = createNotification(isCut ? 'Moving file...' : 'Copying file...');
    if (isCut) {
      if (massCopiedItems[0].path == 'null') {
        window.electronAPI.moveItem(copiedItem.filePath, currentPath).then((data) => {
          if (!data.success) {
            showCustomAlert(data.title, data.message);
            return;
          }
          loadDirectory(currentPath);
          setTimeout(() => removeNotification(noti), 500);
        }).catch((error) => {
          showCustomAlert('Error moving item:', error);
        });
        copiedItem = { filePath: null };
        massCopiedItems = [{ path: 'null' }];
        selectedFile = 'null';
        selectedFileIsDir = false;
        isCut = false;
        massCut = false;
      } else {
        window.electronAPI.massMoveItem(massCopiedItems, currentPath).then((data) => {
          if (!data.success) {
            showCustomAlert(data.title, data.message);
            return;
          }
          loadDirectory(currentPath);
          setTimeout(() => removeNotification(noti), 500);
        }).catch((error) => {
          showCustomAlert('Error moving item:', error);
        });
        copiedItem = { filePath: null };
        massCopiedItems = [{ path: 'null' }];
        selectedFile = 'null';
        selectedFileIsDir = false;
        isCut = false;
        massCut = false;
      }
    } else {
      if (massCopiedItems[0].path == 'null') {
        window.electronAPI.copyItem(copiedItem.filePath, currentPath).then((data) => {
          if (!data.success) {
            showCustomAlert(data.title, data.message);
            return;
          }
          loadDirectory(currentPath);
          setTimeout(() => removeNotification(noti), 500);
        }).catch((error) => {
          showCustomAlert('Error copying item:', error);
        });
        copiedItem = { filePath: null };
        massCopiedItems = [{ path: 'null' }];
        selectedFile = 'null';
        selectedFileIsDir = false;
        isCut = false;
        massCut = false;
      } else {
        window.electronAPI.massCopyItem(massCopiedItems, currentPath).then((data) => {
          if (!data.success) {
            showCustomAlert(data.title, data.message);
            return;
          }
          loadDirectory(currentPath);
          setTimeout(() => removeNotification(noti), 500);
        }).catch((error) => {
          showCustomAlert('Error copying item:', error);
        });
      }
      copiedItem = { filePath: null };
      massCopiedItems = [{ path: 'null' }];
      selectedFile = 'null';
      selectedFileIsDir = false;
      isCut = false;
      massCut = false;
    }
    copiedItem = { filePath: null };
    massCopiedItems = [{ path: 'null' }];
    isCut = false;
    massCut = false;
    massSelectFile = null;
  }
});

window.electronAPI.onOperationProgress((event, progress) => {
  const noti = document.querySelector('.notification');
  if (noti) {
    noti.querySelector('.progress-bar').style.width = `${progress}%`;
    if (progress === 100) {
      setTimeout(() => removeNotification(noti), 500);
    }
  }
});

function showPropertiesModal(filePath) {
  window.electronAPI.getFileProperties(filePath).then((properties) => {
    document.getElementById('propName').textContent = properties.name;
    document.getElementById('propPath').textContent = properties.path;
    document.getElementById('propSize').textContent = properties.size;
    document.getElementById('propType').textContent = properties.type;
    document.getElementById('propModified').textContent = properties.modified;
    document.getElementById('propCreated').textContent = properties.created;

    const tagsContainer = document.getElementById('propTags');
    tagsContainer.innerHTML = '';
    if (properties.tags.length > 0) {
      properties.tags.forEach(tag => {
        const tagElement = document.createElement('span');
        tagElement.className = 'badge badge-primary';
        tagElement.style.backgroundColor = tag.color;
        tagElement.textContent = tag.name;
        tagElement.style.marginRight = '5px';
        tagsContainer.appendChild(tagElement);
      });
    } else {
      tagsContainer.textContent = 'No tags';
    }

    $('#customPropertiesModal').modal('show');
  }).catch((error) => {
    showCustomAlert('Error', 'Failed to load file properties: ' + error.message);
  });
}

// Function to filter files based on the search query
document.getElementById('searchInput').addEventListener('input', () => {
  const searchQuery = document.getElementById('searchInput').value.toLowerCase();
  const fileItems = document.querySelectorAll('.file-item');

  fileItems.forEach(item => {
    const fileName = item.textContent.toLowerCase();
    const tags = item.querySelectorAll('.tag-color');
    const tagNames = Array.from(tags).map(tag => tag.title.toLowerCase());

    if (searchQuery.includes('name:')) {
      const nameQuery = searchQuery.replace('name:', '').trim();
      if (fileName.includes(nameQuery)) {
        item.style.display = 'flex';
      } else {
        item.style.display = 'none';
      }
    } else if (searchQuery.includes('tag:')) {
      const tagQuery = searchQuery.replace('tag:', '').trim();
      if (tagNames.includes(tagQuery)) {
        item.style.display = 'flex';
      } else {
        item.style.display = 'none';
      }
    } else {
      if (fileName.includes(searchQuery) || tagNames.some(tag => tag.includes(searchQuery))) {
        item.style.display = 'flex';
      } else {
        item.style.display = 'none';
      }
    }
  });
});


function createNotification(message, progress = 0) {
  const noti = document.createElement('div');
  noti.classList.add('notification');
  noti.innerHTML = `
    <div class="notification-message">${message}</div>
    <div class="progress">
      <div class="progress-bar" role="progressbar" style="width: ${progress}%;"></div>
    </div>
  `;
  document.querySelector('.notification-container').appendChild(noti);
  return noti;
}

document.querySelectorAll('.menu-item').forEach(item => {
  item.addEventListener('click', () => {
      loadDirectory(normalizePath(item.getAttribute('data-path')))
      document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
      item.classList.add('active');
  });
});  

document.querySelector('.settings').onclick = ()=> {
  showCustomPromptSettings('Settings', (homeButton, landingPage) => saveSettings(homeButton, landingPage));
}

document.querySelector('.setting-landing-icon').onclick = ()=> {
  showCustomAlert('Landing Page', 'The directory you will be shown once the app is open!')
}

document.querySelector('.setting-home-icon').onclick = ()=> {
  showCustomAlert('Home Button', 'The directory you will be shown once the home button is clicked!')
}

function saveSettings(homeButton, landingPage) {
  if (!homeButton) return showCustomAlert('Invalid Input', 'Home Button\'s value cannot be empty')
  if (!landingPage) return showCustomAlert('Invalid Input', 'Landing Page\'s value cannot be empty')
  if (!homeButton.toLowerCase().startsWith('c:/')) return showCustomAlert('Invalid Input', 'Home Button\'s value is invalid!')
  if (!homeButton.toLowerCase().startsWith('c:/')) return showCustomAlert('Invalid Input', 'Landing Page\'s value is invalid!')
    settings.homeButton = normalizePath(homeButton)
    settings.landingPage = normalizePath(landingPage)
  window.electronAPI.writeSettings(settings).catch((error) => {
    console.error('Error writing settings:', error);
  })
}

async function chooseLanding() {
  await window.electronAPI.openDirectory().then(d=> {
    if (!d) return showCustomAlert('Invalid Directory', 'Please pick a valid directory!')
    document.getElementById('landingPageLabel').textContent = `${normalizePath(d)}`;
  }).catch(e=> {
    console.error(e)
    showCustomAlert('Failed to open directory', e)
  })
}

async function chooseHome() {
  await window.electronAPI.openDirectory().then(d=> {
    if (!d) return showCustomAlert('Invalid Directory', 'Please pick a valid directory!')
    document.getElementById('homeButtonLabel').textContent = `${normalizePath(d)}`;
  }).catch(e=> {
    console.error(e)
    showCustomAlert('Failed to open directory', e)
  })
}

document.getElementById('minimize').addEventListener('click', () => {
    window.electronAPI.minimize()
});

document.getElementById('maximize').addEventListener('click', () => {
  window.electronAPI.maximize()
});

document.getElementById('close').addEventListener('click', () => {
  window.electronAPI.close()
});


function removeNotification(noti) {
  if (noti) {
    document.querySelector('.notification-container').removeChild(noti);
  }
}

