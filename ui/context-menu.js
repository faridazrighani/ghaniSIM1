function getContextMenu() {
    let menu = document.getElementById('canvasContextMenu');
    if (!menu) {
        menu = document.createElement('div');
        menu.id = 'canvasContextMenu';
        menu.className = 'context-menu';
        document.body.appendChild(menu);
    }
    return menu;
}

function hideContextMenu() {
    const menu = document.getElementById('canvasContextMenu');
    if (menu) menu.style.display = 'none';
}

function showContextMenu(x, y, items) {
    const menu = getContextMenu();
    menu.innerHTML = '';

    items.forEach(item => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = [
            item.danger ? 'danger' : '',
            item.active ? 'active' : ''
        ].filter(Boolean).join(' ');
        if (item.active) btn.setAttribute('aria-current', 'true');
        if (item.description) {
            btn.innerHTML = `
                <span class="context-menu-label"></span>
                <span class="context-menu-description"></span>
            `;
            btn.querySelector('.context-menu-label').textContent = item.label;
            btn.querySelector('.context-menu-description').textContent = item.description;
            btn.title = `${item.label}: ${item.description}`;
        } else {
            btn.textContent = item.label;
        }
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            hideContextMenu();
            item.action();
        });
        menu.appendChild(btn);
    });

    menu.style.display = 'block';
    const rect = menu.getBoundingClientRect();
    menu.style.left = Math.max(8, Math.min(x, window.innerWidth - rect.width - 8)) + 'px';
    menu.style.top = Math.max(8, Math.min(y, window.innerHeight - rect.height - 8)) + 'px';
}
