// 日志数据结构: {id, title, content, date, image, created, updated}
const logListKey = 'personal_logs';

// LeanCloud 日志表名
const LC_CLASS = 'PersonalLog';

// 登录相关
async function login(username, password) {
    try {
        return await AV.User.logIn(username, password);
    } catch (e) {
        throw e;
    }
}
function logout() {
    AV.User.logOut();
    showLoginSection();
    clearLoginForm();
}
function clearLoginForm() {
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
    document.getElementById('login-error').innerText = '';
}

// 页面切换
function showLoginSection() {
    setDisplay('login-section', true);
    setDisplay('app', false);
    setDisplay('user-bar', false);
}
function showAppSection() {
    setDisplay('login-section', false);
    setDisplay('app', true);
    const user = AV.User.current();
    if (user) {
        document.getElementById('current-username').innerText = user.getUsername();
        setDisplay('user-bar', true);
    }
}
function setDisplay(id, show) {
    document.getElementById(id).style.display = show ? '' : 'none';
}

// 登录按钮事件
const loginBtn = document.getElementById('login-btn');
if (loginBtn) {
    loginBtn.onclick = async function() {
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;
        const errorDiv = document.getElementById('login-error');
        errorDiv.innerText = '';
        if (!username || !password) {
            errorDiv.innerText = '请输入用户名和密码';
            return;
        }
        try {
            await login(username, password);
            showAppSection();
            renderLogList();
        } catch (e) {
            errorDiv.innerText = '登录失败：' + (e.message || '请检查用户名和密码');
        }
    };
}
document.getElementById('logout-btn').onclick = logout;

// 初始化页面显示
function checkLogin() {
    const user = AV.User.current();
    if (user) {
        showAppSection();
        renderLogList();
    } else {
        showLoginSection();
    }
}

// 获取当前用户
function getCurrentUser() {
    return AV.User.current();
}

// 云端操作
async function fetchLogsFromCloud() {
    const user = getCurrentUser();
    if (!user) return [];
    const query = new AV.Query(LC_CLASS);
    query.equalTo('user', user);
    query.descending('createdAt');
    const results = await query.find();
    return results.map(obj => {
        let img = obj.get('image');
        // 尝试将 image 字段解析成数组，如果失败则使用原始值
        try {
            img = JSON.parse(img);
        } catch (e) {
            // img 保持原值
        }
        return {
            id: obj.id,
            title: obj.get('title'),
            content: obj.get('content'),
            date: obj.get('date'),
            image: img,
            created: obj.get('created'),
            updated: obj.get('updated')
        };
    });
}

async function saveLogToCloud(log) {
    const user = getCurrentUser();
    if (!user) return;
    let obj = log.id ? AV.Object.createWithoutData(LC_CLASS, log.id) : new AV.Object(LC_CLASS);
    const acl = new AV.ACL();
    acl.setReadAccess(user, true);
    acl.setWriteAccess(user, true);
    acl.setPublicReadAccess(false);
    obj.setACL(acl);
    obj.set('user', user);
    obj.set('title', log.title);
    obj.set('content', log.content);
    obj.set('date', log.date);
    // 确保 image 是有效的 JSON 字符串
    obj.set('image', JSON.stringify(log.image || []));
    obj.set('created', log.created);
    obj.set('updated', log.updated);
    const savedObj = await obj.save();
    // 返回保存后的对象id
    return savedObj.id;
}

// 覆盖本地的 getLogs/saveLogs，优化存储逻辑
async function getLogs() {
    try {
        const logs = await fetchLogsFromCloud();
        saveLogs(logs.map(log => ({
            id: log.id,
            title: log.title,
            content: log.content,
            date: log.date,
            created: log.created,
            updated: log.updated,
            imageCount: Array.isArray(log.image) ? log.image.length : 0 // 仅存储图片数量
        })));
        return logs;
    } catch {
        return JSON.parse(localStorage.getItem(logListKey) || '[]');
    }
}

function saveLogs(logs) {
    try {
        localStorage.setItem(logListKey, JSON.stringify(logs));
    } catch (error) {
        console.error('保存日志到 localStorage 失败:', error);
        alert('本地存储空间不足，无法保存日志列表。请尝试以下操作：\n1. 清理浏览器缓存。\n2. 删除部分日志以释放空间。');
    }
}

// 修改图片预览函数，支持移除图片
function renderImagePreview(imgArray) {
    const preview = document.getElementById('image-preview');
    if (imgArray && imgArray.length) {
        preview.innerHTML = imgArray.map((img, index) => `
            <div style="position: relative; display: inline-block; margin-right: 8px;">
                <img style="max-width: 120px; max-height: 120px; border-radius: 4px; border: 1px solid #eee;" src="${img}" alt="预览" />
                <button style="position: absolute; top: -8px; right: -8px; background: red; color: white; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer;" onclick="removeImage(${index})">×</button>
            </div>
        `).join('');
    } else {
        preview.innerHTML = '';
    }
}

// 添加移除图片的函数
function removeImage(index) {
    currentImagesBase64.splice(index, 1);
    renderImagePreview(currentImagesBase64);
}

// 修改 renderLogList，确保正确加载图片
async function renderLogList() {
    const logs = await getLogs();
    const list = document.getElementById('log-list');
    list.innerHTML = '';
    if (!logs.length) {
        list.innerHTML = '<li style="text-align:center;color:#aaa;">暂无日志</li>';
        return;
    }
    logs.forEach(log => {
        const li = document.createElement('li');
        let imgHtml = '';
        if (log.image && Array.isArray(log.image) && log.image.length > 0) {
            imgHtml = `<img class='log-thumb' src='${log.image[0]}' alt='缩略图' />`;
        }
        li.innerHTML = `
            ${imgHtml}
            <div class='log-title'>${log.title}</div>
            ${log.content ? `<div class='log-content-preview'>${log.content.replace(/\n/g, ' ').slice(0, 60)}${log.content.length > 60 ? '...' : ''}</div>` : ''}
            <div class='log-meta'>${log.date ? `<span class='log-date'>${log.date}</span>` : ''}<span class='log-time'>${log.updated || log.created}</span></div>
        `;
        li.addEventListener('click', function(e) {
            if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
            showLogView(log.id);
        });
        list.appendChild(li);
    });
}

function showSection(section) {
    setDisplay('log-list-section', section === 'list');
    setDisplay('log-edit-section', section === 'edit');
    setDisplay('log-view-section', section === 'view');
    const delBtn = document.getElementById('delete-log-btn');
    if (delBtn) delBtn.style.display = section === 'view' ? '' : 'none';
}

// 将单张图片变量改为数组，支持多图上传
let currentImagesBase64 = [];

// 工具函数：图片压缩
async function compressImage(base64String, maxWidth = 1200, quality = 0.8) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            
            if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
            }
            
            canvas.width = width;
            canvas.height = height;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = base64String;
    });
}

// 工具函数：防抖
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// 显示加载状态
function showLoading(show, message = '保存中...') {
    let loading = document.getElementById('loading-overlay');
    if (!loading) {
        loading = document.createElement('div');
        loading.id = 'loading-overlay';
        loading.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
        `;
        const content = document.createElement('div');
        content.style.cssText = `
            background: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        `;
        loading.appendChild(content);
        document.body.appendChild(loading);
    }
    const content = loading.querySelector('div');
    content.innerHTML = `
        <div class="loading-spinner"></div>
        <div style="margin-top: 10px;">${message}</div>
    `;
    loading.style.display = show ? 'flex' : 'none';
}

// 修改图片上传处理，支持追加模式
document.getElementById('log-image').onchange = async function(e) {
    const files = e.target.files;
    if (files.length > 9 - currentImagesBase64.length) {
        alert('每条日志最多上传 9 张图片');
        return;
    }
    if (files.length) {
        showLoading(true, '处理图片中...');
        try {
            const promises = Array.from(files).map(file => {
                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = async (evt) => {
                        // 压缩图片
                        const compressed = await compressImage(evt.target.result);
                        resolve(compressed);
                    };
                    reader.readAsDataURL(file);
                });
            });
            
            const results = await Promise.all(promises);
            currentImagesBase64 = currentImagesBase64.concat(results); // 追加模式
            renderImagePreview(currentImagesBase64);
        } catch (error) {
            console.error('图片处理失败:', error);
            alert('图片处理失败，请重试');
        } finally {
            showLoading(false);
        }
    }
};

// 删除日志（云端）
async function deleteLogFromCloud(id) {
    if (!id) return;
    await AV.Object.createWithoutData(LC_CLASS, id).destroy();
}

// 优化保存逻辑，添加重试机制
async function saveLogWithRetry(log, maxRetries = 3) {
    let retries = 0;
    while (retries < maxRetries) {
        try {
            return await saveLogToCloud(log);
        } catch (error) {
            retries++;
            if (retries === maxRetries) {
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, 1000 * retries));
        }
    }
}

// 修改保存日志函数
async function saveLog(id) {
    try {
        showLoading(true, '保存中...');
        const title = document.getElementById('log-title').value.trim();
        const content = document.getElementById('log-content').value.trim();
        const date = document.getElementById('log-date').value;
        const images = currentImagesBase64;

        if (!title || !content) {
            alert('标题和内容不能为空！');
            return;
        }

        let log = {
            id: id || '',
            title,
            content,
            date,
            image: images,
            updated: new Date().toLocaleString()
        };

        if (!id) {
            log.created = log.updated;
            log.updated = '';
        }

        // 使用重试机制保存
        const savedId = await saveLogWithRetry(log);
        if (!log.id) {
            log.id = savedId;
        }

        // 更新本地缓存
        const logs = await getLogs();
        const index = logs.findIndex(l => l.id === log.id);
        if (index >= 0) {
            logs[index] = log;
        } else {
            logs.unshift(log);
        }
        saveLogs(logs);

        await renderLogList();
        showSection('list');
    } catch (error) {
        console.error('保存日志失败:', error);
        alert('保存失败，请重试');
    } finally {
        showLoading(false);
    }
}

// 为保存按钮添加防抖
document.getElementById('save-log-btn').onclick = debounce(() => {
    const id = document.querySelector('#edit-title').innerText === '编辑日志' ? 
        currentEditingLog?.id : null;
    saveLog(id);
}, 300);

// 添加当前编辑日志的引用
let currentEditingLog = null;

// 修改 showLogEdit 函数，在编辑时支持多图
function showLogEdit(log) {
    currentEditingLog = log;
    showSection('edit');
    document.getElementById('edit-title').innerText = log ? '编辑日志' : '新增日志';
    document.getElementById('log-title').value = log ? log.title : '';
    document.getElementById('log-content').value = log ? log.content : '';
    document.getElementById('log-date').value = log ? log.date : (new Date().toISOString().slice(0,10));
    // 若已有图片则认为存的是数组，否则转换成数组
    currentImagesBase64 = log && log.image ? (Array.isArray(log.image) ? log.image : [log.image]) : [];
    renderImagePreview(currentImagesBase64);
    document.getElementById('log-image').value = '';
    document.getElementById('save-log-btn').onclick = debounce(() => saveLog(log ? log.id : null), 300);
    document.getElementById('cancel-edit-btn').onclick = function() {
        showSection('list');
        renderLogList();
    };
    // 动态添加删除按钮并放入edit-btn-group中
    let delBtn = document.getElementById('edit-delete-btn');
    const btnGroup = document.querySelector('#log-edit-section .edit-btn-group');
    if (!delBtn) {
        delBtn = document.createElement('button');
        delBtn.id = 'edit-delete-btn';
        delBtn.className = 'delete-btn';
        delBtn.innerText = '删除日志';
        delBtn.onclick = async function() {
            if (log && log.id && confirm('确定要删除这条日志吗？')) {
                await deleteLogFromCloud(log.id);
                showSection('list');
                renderLogList();
            }
        };
        btnGroup.appendChild(delBtn);
    } else {
        delBtn.style.display = log ? '' : 'none';
        delBtn.onclick = async function() {
            if (log && log.id && confirm('确定要删除这条日志吗？')) {
                await deleteLogFromCloud(log.id);
                showSection('list');
                renderLogList();
            }
        };
    }
    if (!log) {
        if (delBtn) delBtn.style.display = 'none';
    }
}

// 修改 showLogView，动态从云端加载图片数据
async function showLogView(id) {
    const logs = await getLogs();
    const log = logs.find(l => l.id === id);
    if (!log) return;
    showSection('view');
    document.getElementById('view-title').innerText = log.title;
    document.getElementById('view-content').innerText = log.content;
    document.getElementById('view-date').innerText = log.date ? `日期：${log.date}` : '';

    const imageContainer = document.getElementById('view-image-container');
    imageContainer.innerHTML = ''; // 清空之前的图片

    if (log.image && Array.isArray(log.image) && log.image.length > 0) {
        const imageCount = log.image.length;
        let gridClass = '';
        if (imageCount === 1) {
            gridClass = 'single-image';
        } else if (imageCount <= 3) {
            gridClass = 'row-grid';
        } else if (imageCount <= 6) {
            gridClass = 'two-row-grid';
        } else {
            gridClass = 'nine-grid';
        }
        imageContainer.className = gridClass;

        log.image.forEach(imgSrc => {
            const img = document.createElement('img');
            img.src = imgSrc;
            img.alt = '日志图片';
            img.style.cursor = 'zoom-in';
            img.onclick = function() {
                const modalImg = document.getElementById('img-modal-img');
                const modal = document.getElementById('img-modal');
                modalImg.src = imgSrc;
                modal.style.display = 'flex';
            };
            imageContainer.appendChild(img);
        });
    }

    document.getElementById('edit-log-btn').onclick = function() {
        showLogEdit(log);
    };
    document.getElementById('back-list-btn').onclick = function() {
        showSection('list');
        renderLogList();
    };
    // 动态添加删除按钮到view-btn-group
    let delBtn = document.getElementById('delete-log-btn');
    const btnGroup = document.querySelector('#log-view-section .view-btn-group');
    if (!delBtn) {
        delBtn = document.createElement('button');
        delBtn.id = 'delete-log-btn';
        delBtn.className = 'delete-btn';
        delBtn.innerText = '删除日志';
        delBtn.onclick = async function() {
            if (confirm('确定要删除这条日志吗？')) {
                await deleteLogFromCloud(log.id);
                showSection('list');
                renderLogList();
            }
        };
        btnGroup.appendChild(delBtn);
    } else {
        delBtn.onclick = async function() {
            if (confirm('确定要删除这条日志吗？')) {
                await deleteLogFromCloud(log.id);
                showSection('list');
                renderLogList();
            }
        };
        delBtn.style.display = '';
        // 确保按钮在view-btn-group内
        if (delBtn.parentNode !== btnGroup) {
            btnGroup.appendChild(delBtn);
        }
    }
}

// 大图预览功能
function setupImageModal() {
    const viewImg = document.getElementById('view-image');
    const modal = document.getElementById('img-modal');
    const modalImg = document.getElementById('img-modal-img');
    if (viewImg && modal && modalImg) {
        viewImg.onclick = function() {
            if (viewImg.src && viewImg.style.display !== 'none') {
                modalImg.src = viewImg.src;
                modal.style.display = 'flex';
            }
        };
        modal.onclick = function() {
            modal.style.display = 'none';
            modalImg.src = '';
        };
    }
}

// 添加样式到页面
const style = document.createElement('style');
style.textContent = `
    .loading-spinner {
        width: 40px;
        height: 40px;
        border: 4px solid #f3f3f3;
        border-top: 4px solid #3498db;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto;
    }
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);

// 初始化
checkLogin();
showSection('list');
setupImageModal();