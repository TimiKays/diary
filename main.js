// 日志数据结构: {id, title, content, date, image, created, updated}
const logListKey = 'personal_logs';

// LeanCloud 日志表名
const LC_CLASS = 'PersonalLog';

// 登录相关
async function login(username, password) {
    try {
        const user = await AV.User.logIn(username, password);
        return user;
    } catch (e) {
        throw e;
    }
}
function logout() {
    AV.User.logOut();
    showLoginSection();
    // 清空输入框和错误提示
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
    document.getElementById('login-error').innerText = '';
}

// 页面切换
function showLoginSection() {
    document.getElementById('login-section').style.display = '';
    document.getElementById('app').style.display = 'none';
    document.getElementById('user-bar').style.display = 'none';
}
function showAppSection() {
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('app').style.display = '';
    // 显示用户名
    const user = AV.User.current();
    if (user) {
        document.getElementById('current-username').innerText = user.getUsername();
        document.getElementById('user-bar').style.display = '';
    }
}

// 绑定登录按钮
document.getElementById('login-btn').onclick = async function() {
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
    let obj;
    if (log.id) {
        obj = AV.Object.createWithoutData(LC_CLASS, log.id);
    } else {
        obj = new AV.Object(LC_CLASS);
    }
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
    let logs = [];
    try {
        logs = await fetchLogsFromCloud();
        saveLogs(logs); // 同步到本地缓存
    } catch (e) {
        logs = JSON.parse(localStorage.getItem(logListKey) || '[]');
    }
    return logs;
}
function saveLogs(logs) {
    localStorage.setItem(logListKey, JSON.stringify(logs));
}

async function renderLogList() {
    const logs = await getLogs();
    const list = document.getElementById('log-list');
    list.innerHTML = '';
    if (logs.length === 0) {
        list.innerHTML = '<li style="text-align:center;color:#aaa;">暂无日志</li>';
        return;
    }
    logs.forEach(log => {
        const li = document.createElement('li');
        let imgHtml = log.image ? `<img class='log-thumb' src='${log.image}' alt='缩略图' />` : '';
        let metaHtml = `<div class='log-meta'>${log.date ? `<span class='log-date'>${log.date}</span>` : ''}<span class='log-time'>${log.updated || log.created}</span></div>`;
        let titleHtml = `<div class='log-title'>${log.title}</div>`;
        let contentPreview = log.content ? `<div class='log-content-preview'>${log.content.replace(/\n/g, ' ').slice(0, 60)}${log.content.length > 60 ? '...' : ''}</div>` : '';
        li.innerHTML = `${imgHtml}${metaHtml}${titleHtml}${contentPreview}`;
        li.onclick = () => showLogView(log.id);
        list.appendChild(li);
    });
}

function showSection(section) {
    document.getElementById('log-list-section').style.display = section === 'list' ? '' : 'none';
    document.getElementById('log-edit-section').style.display = section === 'edit' ? '' : 'none';
    document.getElementById('log-view-section').style.display = section === 'view' ? '' : 'none';
    let delBtn = document.getElementById('delete-log-btn');
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
            reader.onload = function(evt) {
                currentImageBase64 = evt.target.result;
                renderImagePreview(currentImageBase64);
            };
            reader.readAsDataURL(file);
        }
    };
    document.getElementById('save-log-btn').onclick = function() {
        saveLog(log ? log.id : null);
    };
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
    // 动态添加删除按钮
    let delBtn = document.getElementById('delete-log-btn');
    if (!delBtn) {
        delBtn = document.createElement('button');
        delBtn.id = 'delete-log-btn';
        delBtn.innerText = '删除日志';
        delBtn.style.background = '#e53e3e';
        delBtn.style.color = '#fff';
        delBtn.style.marginLeft = '12px';
        delBtn.style.border = 'none';
        delBtn.style.borderRadius = '4px';
        delBtn.style.padding = '6px 16px';
        delBtn.style.cursor = 'pointer';
        delBtn.onclick = async function() {
            if (confirm('确定要删除这条日志吗？')) {
                await deleteLogFromCloud(log.id);
                showSection('list');
                renderLogList();
            }
        };
        document.getElementById('log-view-section').appendChild(delBtn);
    } else {
        delBtn.onclick = async function() {
            if (confirm('确定要删除这条日志吗？')) {
                await deleteLogFromCloud(log.id);
                showSection('list');
                renderLogList();
            }
        };
        delBtn.style.display = '';
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
    const obj = AV.Object.createWithoutData(LC_CLASS, id);
    await obj.destroy();
}

// 初始化
checkLogin();
showSection('list');

document.getElementById('logout-btn').onclick = logout; 