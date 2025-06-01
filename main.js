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
    return results.map(obj => ({
        id: obj.id,
        title: obj.get('title'),
        content: obj.get('content'),
        date: obj.get('date'),
        image: obj.get('image'),
        created: obj.get('created'),
        updated: obj.get('updated')
    }));
}
async function saveLogToCloud(log) {
    const user = getCurrentUser();
    if (!user) return;
    let obj = log.id ? AV.Object.createWithoutData(LC_CLASS, log.id) : new AV.Object(LC_CLASS);
    // 增加 ACL 权限控制：仅允许当前用户访问（可按需扩展）
    const acl = new AV.ACL();
    acl.setReadAccess(user, true);
    acl.setWriteAccess(user, true);
    acl.setPublicReadAccess(false);
    obj.setACL(acl);
    obj.set('user', user);
    obj.set('title', log.title);
    obj.set('content', log.content);
    obj.set('date', log.date);
    obj.set('image', log.image);
    obj.set('created', log.created);
    obj.set('updated', log.updated);
    await obj.save();
}

// 覆盖本地的getLogs/saveLogs，优先云端
async function getLogs() {
    try {
        const logs = await fetchLogsFromCloud();
        saveLogs(logs);
        return logs;
    } catch {
        return JSON.parse(localStorage.getItem(logListKey) || '[]');
    }
}
function saveLogs(logs) {
    localStorage.setItem(logListKey, JSON.stringify(logs));
}

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
        if (log.image) {
            imgHtml = `<img class='log-thumb' src='${log.image}' alt='缩略图' />`;
        }
        li.innerHTML = `
            ${imgHtml}
            <div class='log-meta'>${log.date ? `<span class='log-date'>${log.date}</span>` : ''}<span class='log-time'>${log.updated || log.created}</span></div>
            <div class='log-title'>${log.title}</div>
            ${log.content ? `<div class='log-content-preview'>${log.content.replace(/\n/g, ' ').slice(0, 60)}${log.content.length > 60 ? '...' : ''}</div>` : ''}
        `;
        // 判断图片为竖图时加tall-item类
        if (log.image) {
            const img = new window.Image();
            img.src = log.image;
            img.onload = function() {
                if (img.naturalHeight > img.naturalWidth) {
                    li.classList.add('tall-item');
                }
            };
        }
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

let currentImageBase64 = '';

function showLogEdit(log) {
    showSection('edit');
    document.getElementById('edit-title').innerText = log ? '编辑日志' : '新增日志';
    document.getElementById('log-title').value = log ? log.title : '';
    document.getElementById('log-content').value = log ? log.content : '';
    document.getElementById('log-date').value = log ? log.date : (new Date().toISOString().slice(0,10));
    currentImageBase64 = log && log.image ? log.image : '';
    renderImagePreview(currentImageBase64);
    document.getElementById('log-image').value = '';
    document.getElementById('log-image').onchange = function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = evt => {
                currentImageBase64 = evt.target.result;
                renderImagePreview(currentImageBase64);
            };
            reader.readAsDataURL(file);
        }
    };
    document.getElementById('save-log-btn').onclick = () => saveLog(log ? log.id : null);
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

function renderImagePreview(img) {
    const preview = document.getElementById('image-preview');
    preview.innerHTML = img ? `<img src='${img}' alt='预览' />` : '';
}

async function showLogView(id) {
    const logs = await getLogs();
    const log = logs.find(l => l.id === id);
    if (!log) return;
    showSection('view');
    document.getElementById('view-title').innerText = log.title;
    document.getElementById('view-content').innerText = log.content;
    document.getElementById('view-date').innerText = log.date ? `日期：${log.date}` : '';
    const img = document.getElementById('view-image');
    if (log.image) {
        img.src = log.image;
        img.style.display = '';
    } else {
        img.style.display = 'none';
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

async function saveLog(id) {
    const title = document.getElementById('log-title').value.trim();
    const content = document.getElementById('log-content').value.trim();
    const date = document.getElementById('log-date').value;
    const image = currentImageBase64;
    if (!title || !content) {
        alert('标题和内容不能为空！');
        return;
    }
    let logs = await getLogs();
    let log;
    if (id) {
        // 修改
        logs = logs.map(l => {
            if (l.id === id) {
                log = {...l, title, content, date, image, updated: new Date().toLocaleString()};
                return log;
            }
            return l;
        });
    } else {
        // 新增
        log = {
            id: '', // 先空，云端保存后会有id
            title,
            content,
            date,
            image,
            created: new Date().toLocaleString(),
            updated: ''
        };
        logs.unshift(log);
    }
    await saveLogToCloud(log);
    renderLogList();
    showSection('list');
}

document.getElementById('add-log-btn').onclick = function() {
    showLogEdit(null);
};
document.getElementById('cancel-edit-btn').onclick = function() {
    showSection('list');
    renderLogList();
};

// 删除日志（云端）
async function deleteLogFromCloud(id) {
    if (!id) return;
    await AV.Object.createWithoutData(LC_CLASS, id).destroy();
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

// 初始化
checkLogin();
showSection('list');
setupImageModal();