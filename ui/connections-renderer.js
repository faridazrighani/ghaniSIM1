function getPortPosition(id, portSelector) {
    const el = getObjectElement(id);
    if (!el) return null;
    const port = el.querySelector(portSelector);
    if (!port) return null;

    const rect = port.getBoundingClientRect();
    const canvas = document.getElementById('canvas');
    const canvasRect = canvas.getBoundingClientRect();

    return {
        x: rect.left - canvasRect.left + rect.width / 2 + canvas.scrollLeft,
        y: rect.top - canvasRect.top + rect.height / 2 + canvas.scrollTop
    };
}

function getObjectCenterPosition(id) {
    const el = getObjectElement(id);
    if (!el) return null;

    const attachedLineMonitorReadout = el.classList.contains('object-type-lineMonitor') && el.classList.contains('is-attached')
        ? el.querySelector('.line-monitor-readout')
        : null;
    const target = attachedLineMonitorReadout || el.querySelector('.object-icon') || el;
    const rect = target.getBoundingClientRect();
    const canvas = document.getElementById('canvas');
    const canvasRect = canvas.getBoundingClientRect();

    return {
        x: rect.left - canvasRect.left + rect.width / 2 + canvas.scrollLeft,
        y: rect.top - canvasRect.top + rect.height / 2 + canvas.scrollTop
    };
}

function buildPipeRoutePoints(p1, p2, routeStyle = 'Straight') {
    if (routeStyle !== 'Elbow') return [p1, p2];

    const midX = (p1.x + p2.x) / 2;
    return [
        p1,
        { x: midX, y: p1.y },
        { x: midX, y: p2.y },
        p2
    ];
}

function pointsToPath(points) {
    return points.map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ');
}

function getRoutePointAtLocation(points, location = 0.5) {
    let totalLength = 0;
    for (let i = 1; i < points.length; i++) {
        totalLength += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }

    const clampedLocation = Math.max(0, Math.min(1, parseFloat(location)));
    let targetLength = totalLength * (Number.isFinite(clampedLocation) ? clampedLocation : 0.5);
    for (let i = 1; i < points.length; i++) {
        const start = points[i - 1];
        const end = points[i];
        const segmentLength = Math.hypot(end.x - start.x, end.y - start.y);
        if (targetLength <= segmentLength || i === points.length - 1) {
            const t = segmentLength === 0 ? 0 : targetLength / segmentLength;
            return {
                x: start.x + (end.x - start.x) * t,
                y: start.y + (end.y - start.y) * t
            };
        }
        targetLength -= segmentLength;
    }

    return points[0];
}

function getRouteMidpoint(points) {
    return getRoutePointAtLocation(points, 0.5);
}

function getRouteLocationFromPoint(points, point) {
    let totalLength = 0;
    let bestDistance = Infinity;
    let bestLength = 0;
    let traversedLength = 0;

    for (let i = 1; i < points.length; i++) {
        const start = points[i - 1];
        const end = points[i];
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const segmentLength = Math.hypot(dx, dy);
        totalLength += segmentLength;
        if (segmentLength === 0) continue;

        const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / Math.pow(segmentLength, 2)));
        const projected = {
            x: start.x + dx * t,
            y: start.y + dy * t
        };
        const distance = Math.hypot(point.x - projected.x, point.y - projected.y);
        if (distance < bestDistance) {
            bestDistance = distance;
            bestLength = traversedLength + segmentLength * t;
        }

        traversedLength += segmentLength;
    }

    return totalLength === 0 ? 0.5 : Math.max(0, Math.min(1, bestLength / totalLength));
}

function getPipeRoutePoints(pipeId) {
    const conn = connections.find(item => item.pipeId === pipeId);
    if (!conn) return null;

    const p1 = getPortPosition(conn.from, conn.fromPort);
    const p2 = getPortPosition(conn.to, conn.toPort);
    if (!p1 || !p2) return null;

    const routeStyle = globalModel[pipeId]?.props?.routeStyle || 'Straight';
    return buildPipeRoutePoints(p1, p2, routeStyle);
}

function getPipeTapPosition(pipeId, location = 0.5) {
    const routePoints = getPipeRoutePoints(pipeId);
    return routePoints ? getRoutePointAtLocation(routePoints, location) : null;
}

function getSourceAttachTargetPosition(link) {
    if (!link) return null;
    return getPortPosition(link.targetId, link.targetPort || '.port.inlet')
        || getPortPosition(link.targetId, '.port.inlet')
        || getObjectCenterPosition(link.targetId);
}

function getPipeLocationFromEvent(pipeId, event) {
    const routePoints = getPipeRoutePoints(pipeId);
    if (!routePoints) return 0.5;
    const point = getCanvasPointFromEvent(event);
    return getRouteLocationFromPoint(routePoints, point);
}

function drawConnections() {
    const svg = document.getElementById('svg-lines');
    let pathHTML = `
        <defs>
            <marker id="source-link-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#2f7d32"></path>
            </marker>
        </defs>
    `;
    
    connections.forEach(conn => {
        const routePoints = getPipeRoutePoints(conn.pipeId);
        if (routePoints) {
            const isSelected = (currentSelectedNode === conn.pipeId);
            const strokeColor = isSelected ? '#ffb703' : 'var(--pipe-color)';
            const strokeWidth = isSelected ? '8' : '4';
            pathHTML += `<path class="pipe-line" data-pipe-id="${conn.pipeId}" d="${pointsToPath(routePoints)}" stroke="${strokeColor}" stroke-width="${strokeWidth}" fill="none" stroke-linejoin="round" stroke-linecap="round" style="cursor: pointer; pointer-events: stroke;" />`;
        }
    });

    instrumentLinks.forEach(link => {
        const instrument = globalModel[link.instrumentId];
        const pipe = globalModel[link.pipeId];
        if (!instrument || !pipe) return;

        const p1 = getObjectCenterPosition(link.instrumentId);
        const p2 = getPipeTapPosition(link.pipeId, link.location);
        if (!p1 || !p2) return;

        const selected = currentSelectedNode === link.instrumentId;
        const strokeColor = selected ? '#0078d7' : '#627d98';
        pathHTML += `<path class="instrument-tap-line" d="${pointsToPath([p1, p2])}" stroke="${strokeColor}" fill="none" />`;
        pathHTML += `<circle class="instrument-tap-point" cx="${p2.x}" cy="${p2.y}" r="4" fill="#fff" stroke="${strokeColor}" stroke-width="1.5" />`;
    });

    sourceLinks.forEach(link => {
        const source = globalModel[link.sourceId];
        const target = globalModel[link.targetId];
        if (!source || !target) return;
        if (typeof isSourceTypeSemanticAttachmentCapable === 'function' && !isSourceTypeSemanticAttachmentCapable(source)) return;

        const p1 = getPortPosition(link.sourceId, '.port.outlet') || getObjectCenterPosition(link.sourceId);
        const p2 = getSourceAttachTargetPosition(link);
        if (!p1 || !p2) return;

        const selected = currentSelectedNode === link.sourceId || currentSelectedNode === link.targetId;
        const strokeColor = selected ? '#2f7d32' : '#5c7f5c';
        pathHTML += `<path class="source-feed-line" d="${pointsToPath([p1, p2])}" stroke="${strokeColor}" marker-end="url(#source-link-arrow)" fill="none" />`;
        pathHTML += `<circle class="source-feed-point" cx="${p2.x}" cy="${p2.y}" r="4" fill="#f7fff7" stroke="${strokeColor}" stroke-width="1.5" />`;
    });
    
    if (pendingConnectionStart && Number.isFinite(pendingConnectionStart.currentX)) {
        const p1 = pendingConnectionStart.kind === 'instrument'
            ? getObjectCenterPosition(pendingConnectionStart.id)
            : pendingConnectionStart.kind === 'source'
                ? (getPortPosition(pendingConnectionStart.id, '.port.outlet') || getObjectCenterPosition(pendingConnectionStart.id))
            : getPortPosition(pendingConnectionStart.id, pendingConnectionStart.portSelector);
        if (p1) {
            const p2 = { x: pendingConnectionStart.currentX, y: pendingConnectionStart.currentY };
            if (pendingConnectionStart.kind === 'instrument') {
                pathHTML += `<path class="instrument-tap-line pipe-preview-line" d="${pointsToPath([p1, p2])}" stroke="#627d98" fill="none" />`;
            } else if (pendingConnectionStart.kind === 'source') {
                pathHTML += `<path class="source-feed-line pipe-preview-line" d="${pointsToPath([p1, p2])}" stroke="#5c7f5c" marker-end="url(#source-link-arrow)" fill="none" />`;
            } else {
                const routePoints = buildPipeRoutePoints(p1, p2, pendingConnectionStart.routeStyle || 'Straight');
                pathHTML += `<path class="pipe-preview-line hydraulic-preview-line" d="${pointsToPath(routePoints)}" stroke="var(--pipe-color)" stroke-width="4" fill="none" stroke-linejoin="round" stroke-linecap="round" />`;
            }
        }
    }
    
    svg.innerHTML = pathHTML;
    
    // Attach click listeners to pipes
    svg.querySelectorAll('.pipe-line').forEach(path => {
        path.addEventListener('pointerdown', (e) => {
            if (e.button !== undefined && e.button !== 0) return;
            e.stopPropagation();
            if (appMode === 'CONNECT') {
                if (pendingConnectionStart && pendingConnectionStart.kind === 'instrument') {
                    attachInstrumentToPipe(pendingConnectionStart.id, path.dataset.pipeId, getPipeLocationFromEvent(path.dataset.pipeId, e));
                } else if (pendingConnectionStart && pendingConnectionStart.kind === 'source') {
                    return;
                } else {
                    selectNode(path.dataset.pipeId, null);
                    drawConnections();
                }
            } else {
                selectNode(path.dataset.pipeId, null);
                drawConnections();
            }
        });

        path.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const pipeId = path.dataset.pipeId;
            document.querySelectorAll('.pfd-object').forEach(el => el.classList.remove('selected'));
            currentSelectedNode = pipeId;
            drawConnections();
            const routeStyle = globalModel[pipeId]?.props?.routeStyle || 'Straight';
            const nextRouteStyle = routeStyle === 'Elbow' ? 'Straight' : 'Elbow';
            const items = [];
            if (typeof addUserTaskObjectPropertiesMenuItem === 'function') {
                addUserTaskObjectPropertiesMenuItem(items, pipeId);
            }

            if (pendingConnectionStart && pendingConnectionStart.kind === 'instrument') {
                const tapLocation = getPipeLocationFromEvent(pipeId, e);
                items.push({
                    label: 'Connect instrument here',
                    action: () => attachInstrumentToPipe(pendingConnectionStart.id, pipeId, tapLocation)
                });
            }

            items.push(
                {
                    label: nextRouteStyle === 'Elbow' ? 'Use elbow' : 'Use straight',
                    action: () => {
                        if (globalModel[pipeId]) {
                            globalModel[pipeId].props.routeStyle = nextRouteStyle;
                            renderSidebar(pipeId);
                            drawConnections();
                        }
                    }
                },
                { label: 'Disconnect pipe', danger: true, action: () => disconnectPipe(pipeId) }
            );

            showContextMenu(e.clientX, e.clientY, items);
        });
    });
}
