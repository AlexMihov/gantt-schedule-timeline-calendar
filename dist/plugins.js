/**
 * ItemHold plugin
 *
 * @copyright Rafal Pospiech <https://neuronet.io>
 * @author    Rafal Pospiech <neuronet.io@gmail.com>
 * @package   gantt-schedule-timeline-calendar
 * @license   AGPL-3.0 (https://github.com/neuronetio/gantt-schedule-timeline-calendar/blob/master/LICENSE)
 * @link      https://github.com/neuronetio/gantt-schedule-timeline-calendar
 */
function ItemHold(options = {}) {
    let api;
    const defaultOptions = {
        time: 1000,
        movementThreshold: 2,
        action(element, data) { }
    };
    options = Object.assign(Object.assign({}, defaultOptions), options);
    const holding = {};
    const pointer = { x: 0, y: 0 };
    function onPointerDown(item, element, event) {
        if (typeof holding[item.id] === 'undefined') {
            const normalized = api.normalizePointerEvent(event);
            holding[item.id] = { x: normalized.x, y: normalized.y };
            event.stopPropagation();
            event.preventDefault();
            setTimeout(() => {
                if (typeof holding[item.id] !== 'undefined') {
                    let exec = true;
                    const xMovement = Math.abs(holding[item.id].x - pointer.x);
                    const yMovement = Math.abs(holding[item.id].y - pointer.y);
                    if (xMovement > options.movementThreshold) {
                        exec = false;
                    }
                    if (yMovement > options.movementThreshold) {
                        exec = false;
                    }
                    delete holding[item.id];
                    if (exec) {
                        options.action(element, item);
                    }
                }
            }, options.time);
        }
    }
    function onPointerUp(itemId) {
        if (typeof holding[itemId] !== 'undefined') {
            delete holding[itemId];
        }
    }
    function action(element, data) {
        function elementPointerDown(event) {
            onPointerDown(data.item, element, event);
        }
        element.addEventListener('mousedown', elementPointerDown);
        element.addEventListener('touchstart', elementPointerDown);
        function pointerUp() {
            onPointerUp(data.item.id);
        }
        document.addEventListener('mouseup', pointerUp);
        document.addEventListener('touchend', pointerUp);
        function onPointerMove(event) {
            const normalized = api.normalizePointerEvent(event);
            pointer.x = normalized.x;
            pointer.y = normalized.y;
        }
        document.addEventListener('mousemove', onPointerMove);
        document.addEventListener('touchmove', onPointerMove);
        return {
            update(element, changedData) {
                data = changedData;
            },
            destroy(element, data) {
                document.removeEventListener('mouseup', onPointerUp);
                document.removeEventListener('mousemove', onPointerMove);
                element.removeEventListener('mousedown', elementPointerDown);
                document.removeEventListener('touchend', onPointerUp);
                document.removeEventListener('touchmove', onPointerMove);
                element.removeEventListener('touchstart', elementPointerDown);
            }
        };
    }
    return function initialize(vido) {
        api = vido.api;
        vido.state.update('config.actions.chart-timeline-items-row-item', actions => {
            actions.push(action);
            return actions;
        });
    };
}

/**
 * ItemMovement plugin
 *
 * @copyright Rafal Pospiech <https://neuronet.io>
 * @author    Rafal Pospiech <neuronet.io@gmail.com>
 * @package   gantt-schedule-timeline-calendar
 * @license   AGPL-3.0 (https://github.com/neuronetio/gantt-schedule-timeline-calendar/blob/master/LICENSE)
 * @link      https://github.com/neuronetio/gantt-schedule-timeline-calendar
 */
const pointerEventsExists = typeof PointerEvent !== 'undefined';
function ItemMovement(options = {}) {
    const defaultOptions = {
        moveable: true,
        resizable: true,
        resizerContent: '',
        collisionDetection: true,
        outOfBorders: false,
        snapStart(timeStart, startDiff) {
            return timeStart + startDiff;
        },
        snapEnd(timeEnd, endDiff) {
            return timeEnd + endDiff;
        },
        ghostNode: true,
        wait: 0
    };
    options = Object.assign(Object.assign({}, defaultOptions), options);
    const movementState = {};
    /**
     * Add moving functionality to items as action
     *
     * @param {HTMLElement} element DOM Node
     * @param {Object} data
     */
    function ItemAction(element, data) {
        if (!options.moveable && !options.resizable) {
            return;
        }
        const state = data.state;
        const api = data.api;
        function isMoveable(data) {
            let moveable = options.moveable;
            if (data.item.hasOwnProperty('moveable') && moveable) {
                moveable = data.item.moveable;
            }
            if (data.row.hasOwnProperty('moveable') && moveable) {
                moveable = data.row.moveable;
            }
            return moveable;
        }
        function isResizable(data) {
            let resizable = options.resizable && (!data.item.hasOwnProperty('resizable') || data.item.resizable === true);
            if (data.row.hasOwnProperty('resizable') && resizable) {
                resizable = data.row.resizable;
            }
            return resizable;
        }
        function getMovement(data) {
            const itemId = data.item.id;
            if (typeof movementState[itemId] === 'undefined') {
                movementState[itemId] = { moving: false, resizing: false, waiting: false };
            }
            return movementState[itemId];
        }
        function saveMovement(itemId, movement) {
            state.update(`config.plugin.ItemMovement.item`, Object.assign({ id: itemId }, movement));
            state.update('config.plugin.ItemMovement.movement', (current) => {
                if (!current) {
                    current = { moving: false, waiting: false, resizing: false };
                }
                current.moving = movement.moving;
                current.waiting = movement.waiting;
                current.resizing = movement.resizing;
                return current;
            });
        }
        function createGhost(data, normalized, ganttLeft, ganttTop) {
            const movement = getMovement(data);
            if (!options.ghostNode || typeof movement.ghost !== 'undefined') {
                return;
            }
            const ghost = element.cloneNode(true);
            const style = getComputedStyle(element);
            ghost.style.position = 'absolute';
            ghost.style.left = normalized.clientX - ganttLeft + 'px';
            const itemTop = normalized.clientY - ganttTop - element.offsetTop + parseInt(style['margin-top']);
            movement.itemTop = itemTop;
            ghost.style.top = normalized.clientY - ganttTop - itemTop + 'px';
            ghost.style.width = style.width;
            ghost.style['box-shadow'] = '10px 10px 6px #00000020';
            const height = element.clientHeight + 'px';
            ghost.style.height = height;
            ghost.style['line-height'] = element.clientHeight - 18 + 'px';
            ghost.style.opacity = '0.6';
            ghost.style.transform = 'scale(1.05, 1.05)';
            state.get('_internal.elements.chart-timeline').appendChild(ghost);
            movement.ghost = ghost;
            saveMovement(data.item.id, movement);
            return ghost;
        }
        function moveGhost(data, normalized) {
            if (options.ghostNode) {
                const movement = getMovement(data);
                const left = normalized.clientX - movement.ganttLeft;
                movement.ghost.style.left = left + 'px';
                movement.ghost.style.top =
                    normalized.clientY -
                        movement.ganttTop -
                        movement.itemTop +
                        parseInt(getComputedStyle(element)['margin-top']) +
                        'px';
                saveMovement(data.item.id, movement);
            }
        }
        function destroyGhost(itemId) {
            if (!options.ghostNode) {
                return;
            }
            if (typeof movementState[itemId] !== 'undefined' && typeof movementState[itemId].ghost !== 'undefined') {
                state.get('_internal.elements.chart-timeline').removeChild(movementState[itemId].ghost);
                delete movementState[itemId].ghost;
                saveMovement(data.item.id, movementState[itemId]);
            }
        }
        function getSnapStart(data) {
            let snapStart = options.snapStart;
            if (typeof data.item.snapStart === 'function') {
                snapStart = data.item.snapStart;
            }
            return snapStart;
        }
        function getSnapEnd(data) {
            let snapEnd = options.snapEnd;
            if (typeof data.item.snapEnd === 'function') {
                snapEnd = data.item.snapEnd;
            }
            return snapEnd;
        }
        const resizerHTML = `<div class="${api.getClass('chart-timeline-items-row-item-resizer')}">${options.resizerContent}</div>`;
        // @ts-ignore
        element.insertAdjacentHTML('beforeend', resizerHTML);
        const resizerEl = element.querySelector('.gantt-schedule-timeline-calendar__chart-timeline-items-row-item-resizer');
        if (!isResizable(data)) {
            resizerEl.style.visibility = 'hidden';
        }
        else {
            resizerEl.style.visibility = 'visible';
        }
        function labelDown(ev) {
            const normalized = api.normalizePointerEvent(ev);
            if ((ev.type === 'pointerdown' || ev.type === 'mousedown') && ev.button !== 0) {
                return;
            }
            const movement = getMovement(data);
            movement.waiting = true;
            saveMovement(data.item.id, movement);
            setTimeout(() => {
                ev.stopPropagation();
                ev.preventDefault();
                if (!movement.waiting)
                    return;
                movement.moving = true;
                const item = state.get(`config.chart.items.${data.item.id}`);
                const chartLeftTime = state.get('_internal.chart.time.leftGlobal');
                const timePerPixel = state.get('_internal.chart.time.timePerPixel');
                const ganttRect = state.get('_internal.elements.chart-timeline').getBoundingClientRect();
                movement.ganttTop = ganttRect.top;
                movement.ganttLeft = ganttRect.left;
                movement.itemX = Math.round((item.time.start - chartLeftTime) / timePerPixel);
                saveMovement(data.item.id, movement);
                createGhost(data, normalized, ganttRect.left, ganttRect.top);
            }, options.wait);
        }
        function resizerDown(ev) {
            ev.stopPropagation();
            ev.preventDefault();
            if ((ev.type === 'pointerdown' || ev.type === 'mousedown') && ev.button !== 0) {
                return;
            }
            const normalized = api.normalizePointerEvent(ev);
            const movement = getMovement(data);
            movement.resizing = true;
            const item = state.get(`config.chart.items.${data.item.id}`);
            const chartLeftTime = state.get('_internal.chart.time.leftGlobal');
            const timePerPixel = state.get('_internal.chart.time.timePerPixel');
            const ganttRect = state.get('_internal.elements.chart-timeline').getBoundingClientRect();
            movement.ganttTop = ganttRect.top;
            movement.ganttLeft = ganttRect.left;
            movement.itemX = (item.time.end - chartLeftTime) / timePerPixel;
            saveMovement(data.item.id, movement);
        }
        function isCollision(rowId, itemId, start, end) {
            if (!options.collisionDetection) {
                return false;
            }
            const time = state.get('_internal.chart.time');
            if (options.outOfBorders && (start < time.from || end > time.to)) {
                return true;
            }
            let diff = api.time.date(end).diff(start, 'milliseconds');
            if (Math.sign(diff) === -1) {
                diff = -diff;
            }
            if (diff <= 1) {
                return true;
            }
            const row = state.get('config.list.rows.' + rowId);
            for (const rowItem of row._internal.items) {
                if (rowItem.id !== itemId) {
                    if (start >= rowItem.time.start && start <= rowItem.time.end) {
                        return true;
                    }
                    if (end >= rowItem.time.start && end <= rowItem.time.end) {
                        return true;
                    }
                    if (start <= rowItem.time.start && end >= rowItem.time.end) {
                        return true;
                    }
                }
            }
            return false;
        }
        function movementX(normalized, row, item, zoom, timePerPixel) {
            const movement = getMovement(data);
            const left = normalized.clientX - movement.ganttLeft;
            moveGhost(data, normalized);
            const leftMs = state.get('_internal.chart.time.leftGlobal') + left * timePerPixel;
            const add = leftMs - item.time.start;
            const originalStart = item.time.start;
            const finalStartTime = getSnapStart(data)(item.time.start, add, item);
            const finalAdd = finalStartTime - originalStart;
            const collision = isCollision(row.id, item.id, item.time.start + finalAdd, item.time.end + finalAdd);
            if (finalAdd && !collision) {
                state.update(`config.chart.items.${data.item.id}.time`, function moveItem(time) {
                    time.start += finalAdd;
                    time.end = getSnapEnd(data)(time.end, finalAdd, item) - 1;
                    return time;
                });
            }
        }
        function resizeX(normalized, row, item, zoom, timePerPixel) {
            if (!isResizable(data)) {
                return;
            }
            const time = state.get('_internal.chart.time');
            const movement = getMovement(data);
            const left = normalized.clientX - movement.ganttLeft;
            const leftMs = time.leftGlobal + left * timePerPixel;
            const add = leftMs - item.time.end;
            if (item.time.end + add < item.time.start) {
                return;
            }
            const originalEnd = item.time.end;
            const finalEndTime = getSnapEnd(data)(item.time.end, add, item) - 1;
            const finalAdd = finalEndTime - originalEnd;
            const collision = isCollision(row.id, item.id, item.time.start, item.time.end + finalAdd);
            if (finalAdd && !collision) {
                state.update(`config.chart.items.${data.item.id}.time`, time => {
                    time.start = getSnapStart(data)(time.start, 0, item);
                    time.end = getSnapEnd(data)(time.end, finalAdd, item) - 1;
                    return time;
                });
            }
        }
        function movementY(normalized, row, item, zoom, timePerPixel) {
            moveGhost(data, normalized);
            const movement = getMovement(data);
            const top = normalized.clientY - movement.ganttTop;
            const visibleRows = state.get('_internal.list.visibleRows');
            let index = 0;
            for (const currentRow of visibleRows) {
                if (currentRow.top > top) {
                    if (index > 0) {
                        return index - 1;
                    }
                    return 0;
                }
                index++;
            }
            return index;
        }
        function documentMove(ev) {
            const movement = getMovement(data);
            const normalized = api.normalizePointerEvent(ev);
            let item, rowId, row, zoom, timePerPixel;
            if (movement.moving || movement.resizing) {
                ev.stopPropagation();
                ev.preventDefault();
                item = state.get(`config.chart.items.${data.item.id}`);
                rowId = state.get(`config.chart.items.${data.item.id}.rowId`);
                row = state.get(`config.list.rows.${rowId}`);
                zoom = state.get('_internal.chart.time.zoom');
                timePerPixel = state.get('_internal.chart.time.timePerPixel');
            }
            const moveable = isMoveable(data);
            if (movement.moving) {
                if (moveable === true || moveable === 'x' || (Array.isArray(moveable) && moveable.includes(rowId))) {
                    movementX(normalized, row, item, zoom, timePerPixel);
                }
                if (!moveable || moveable === 'x') {
                    return;
                }
                let visibleRowsIndex = movementY(normalized);
                const visibleRows = state.get('_internal.list.visibleRows');
                if (typeof visibleRows[visibleRowsIndex] === 'undefined') {
                    if (visibleRowsIndex > 0) {
                        visibleRowsIndex = visibleRows.length - 1;
                    }
                    else if (visibleRowsIndex < 0) {
                        visibleRowsIndex = 0;
                    }
                }
                const newRow = visibleRows[visibleRowsIndex];
                const newRowId = newRow.id;
                const collision = isCollision(newRowId, item.id, item.time.start, item.time.end);
                if (newRowId !== item.rowId && !collision) {
                    if (!Array.isArray(moveable) || moveable.includes(newRowId)) {
                        if (!newRow.hasOwnProperty('moveable') || newRow.moveable) {
                            state.update(`config.chart.items.${item.id}.rowId`, newRowId);
                        }
                    }
                }
            }
            else if (movement.resizing && (typeof item.resizable === 'undefined' || item.resizable === true)) {
                resizeX(normalized, row, item, zoom, timePerPixel);
            }
        }
        function documentUp(ev) {
            const movement = getMovement(data);
            if (movement.moving || movement.resizing || movement.waiting) {
                ev.stopPropagation();
                ev.preventDefault();
            }
            else {
                return;
            }
            movement.moving = false;
            movement.waiting = false;
            movement.resizing = false;
            saveMovement(data.item.id, movement);
            for (const itemId in movementState) {
                movementState[itemId].moving = false;
                movementState[itemId].resizing = false;
                movementState[itemId].waiting = false;
                destroyGhost(itemId);
            }
        }
        if (pointerEventsExists) {
            element.addEventListener('pointerdown', labelDown);
            resizerEl.addEventListener('pointerdown', resizerDown);
            document.addEventListener('pointermove', documentMove);
            document.addEventListener('pointerup', documentUp);
        }
        else {
            element.addEventListener('touchstart', labelDown);
            resizerEl.addEventListener('touchstart', resizerDown);
            document.addEventListener('touchmove', documentMove);
            document.addEventListener('touchend', documentUp);
            document.addEventListener('touchcancel', documentUp);
            element.addEventListener('mousedown', labelDown);
            resizerEl.addEventListener('mousedown', resizerDown);
            document.addEventListener('mousemove', documentMove);
            document.addEventListener('mouseup', documentUp);
        }
        return {
            update(node, changedData) {
                if (!isResizable(changedData) && resizerEl.style.visibility === 'visible') {
                    resizerEl.style.visibility = 'hidden';
                }
                else if (isResizable(changedData) && resizerEl.style.visibility === 'hidden') {
                    resizerEl.style.visibility = 'visible';
                }
                data = changedData;
            },
            destroy(node, data) {
                if (pointerEventsExists) {
                    element.removeEventListener('pointerdown', labelDown);
                    resizerEl.removeEventListener('pointerdown', resizerDown);
                    document.removeEventListener('pointermove', documentMove);
                    document.removeEventListener('pointerup', documentUp);
                }
                else {
                    element.removeEventListener('mousedown', labelDown);
                    resizerEl.removeEventListener('mousedown', resizerDown);
                    document.removeEventListener('mousemove', documentMove);
                    document.removeEventListener('mouseup', documentUp);
                    element.removeEventListener('touchstart', labelDown);
                    resizerEl.removeEventListener('touchstart', resizerDown);
                    document.removeEventListener('touchmove', documentMove);
                    document.removeEventListener('touchend', documentUp);
                    document.removeEventListener('touchcancel', documentUp);
                }
                resizerEl.remove();
            }
        };
    }
    return function initialize(vido) {
        vido.state.update('config.actions.chart-timeline-items-row-item', actions => {
            actions.push(ItemAction);
            return actions;
        });
    };
}

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
/**
 * An expression marker with embedded unique key to avoid collision with
 * possible text in templates.
 */
const marker = `{{lit-${String(Math.random()).slice(2)}}}`;
/**
 * Used to clone existing node instead of each time creating new one which is
 * slower
 */
const markerNode = document.createComment('');
/**
 * Used to clone existing node instead of each time creating new one which is
 * slower
 */
const emptyTemplateNode = document.createElement('template');
/**
 * Used to clone text node instead of each time creating new one which is slower
 */
const emptyTextNode = document.createTextNode('');
// Detect event listener options support. If the `capture` property is read
// from the options object, then options are supported. If not, then the third
// argument to add/removeEventListener is interpreted as the boolean capture
// value so we should only pass the `capture` property.
let eventOptionsSupported = false;
// Wrap into an IIFE because MS Edge <= v41 does not support having try/catch
// blocks right into the body of a module
(() => {
    try {
        const options = {
            get capture() {
                eventOptionsSupported = true;
                return false;
            }
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        window.addEventListener('test', options, options);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        window.removeEventListener('test', options, options);
    }
    catch (_e) {
        // noop
    }
})();

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
// IMPORTANT: do not change the property name or the assignment expression.
// This line will be used in regexes to search for lit-html usage.
// TODO(justinfagnani): inject version number at build time
const isBrowser = typeof window !== 'undefined';
if (isBrowser) {
    // If we run in the browser set version
    (window['litHtmlVersions'] || (window['litHtmlVersions'] = [])).push('1.1.7');
}
/**
 * Used to clone existing node instead of each time creating new one which is
 * slower
 */
const emptyTemplateNode$1 = document.createElement('template');

class Action {
    constructor() {
        this.isAction = true;
    }
}
Action.prototype.isAction = true;

const defaultOptions = {
    element: document.createTextNode(''),
    axis: 'xy',
    threshold: 10,
    onDown(data) { },
    onMove(data) { },
    onUp(data) { },
    onWheel(data) { }
};

/**
 * Selection plugin
 *
 * @copyright Rafal Pospiech <https://neuronet.io>
 * @author    Rafal Pospiech <neuronet.io@gmail.com>
 * @package   gantt-schedule-timeline-calendar
 * @license   AGPL-3.0 (https://github.com/neuronetio/gantt-schedule-timeline-calendar/blob/master/LICENSE)
 * @link      https://github.com/neuronetio/gantt-schedule-timeline-calendar
 */
function Selection(options = {}) {
    let vido, state, api, schedule;
    const pluginPath = 'config.plugin.selection';
    const rectClassName = 'gantt-schedule-timeline-caledar__plugin-selection-rect';
    const rect = document.createElement('div');
    rect.classList.add(rectClassName);
    rect.style.visibility = 'hidden';
    rect.style.left = '0px';
    rect.style.top = '0px';
    rect.style.width = '0px';
    rect.style.height = '0px';
    rect.style.background = 'rgba(0, 119, 192, 0.2)';
    rect.style.border = '2px dashed rgba(0, 119, 192, 0.75)';
    rect.style.position = 'absolute';
    rect.style['user-select'] = 'none';
    rect.style['pointer-events'] = 'none';
    const defaultOptions = {
        grid: false,
        items: true,
        rows: false,
        horizontal: true,
        vertical: true,
        rectStyle: {},
        selecting() { },
        deselecting() { },
        selected() { },
        deselected() { },
        canSelect(type, currently, all) {
            return currently;
        },
        canDeselect(type, currently, all) {
            return [];
        },
        getApi() { }
    };
    options = Object.assign(Object.assign({}, defaultOptions), options);
    for (const styleProp in options.rectStyle) {
        rect.style[styleProp] = options.rectStyle[styleProp];
    }
    const selecting = {
        fromX: -1,
        fromY: -1,
        toX: -1,
        toY: -1,
        startX: -1,
        startY: -1,
        startCell: false,
        selecting: false
    };
    const selectionTypesIdGetters = {
        'chart-timeline-grid-row': props => props.row.id,
        'chart-timeline-grid-row-block': props => props.id,
        'chart-timeline-items-row': props => props.row.id,
        'chart-timeline-items-row-item': props => props.item.id
    };
    function getEmptyContainer() {
        return {
            'chart-timeline-grid-rows': [],
            'chart-timeline-grid-row-blocks': [],
            'chart-timeline-items-rows': [],
            'chart-timeline-items-row-items': []
        };
    }
    function markSelecting(nowSelecting, addToPrevious = false) {
        if (addToPrevious) {
            state.update(`${pluginPath}.selecting`, selecting => {
                for (const name in selecting) {
                    nowSelecting[name].forEach(id => {
                        if (!selecting[name].includes()) {
                            selecting[name].push(id);
                        }
                    });
                }
                return selecting;
            });
        }
        else {
            state.update(`${pluginPath}.selecting`, nowSelecting);
        }
        state.update('config.chart.items', function updateItems(items) {
            const now = nowSelecting['chart-timeline-items-row-items'];
            for (const itemId in items) {
                const item = items[itemId];
                if (now.includes(item.id)) {
                    item.selecting = true;
                }
                else {
                    item.selecting = false;
                }
            }
            return items;
        }, { only: ['selecting'] });
        state.update('_internal.chart.grid.rowsWithBlocks', function updateRowsWithBlocks(rowsWithBlocks) {
            const nowBlocks = nowSelecting['chart-timeline-grid-row-blocks'];
            const nowRows = nowSelecting['chart-timeline-grid-rows'];
            if (rowsWithBlocks)
                for (const row of rowsWithBlocks) {
                    if (nowRows.includes(row.id)) {
                        row.selecting = true;
                    }
                    else {
                        row.selecting = false;
                    }
                    for (const block of row.blocks) {
                        if (nowBlocks.includes(block.id)) {
                            block.selecting = true;
                        }
                        else {
                            block.selecting = false;
                        }
                    }
                }
            return rowsWithBlocks;
        });
    }
    /**
     * Clear selection
     * @param {boolean} clear
     */
    function clearSelection(clear = false, onlySelecting = false) {
        let selectingState;
        if (onlySelecting) {
            state.update(pluginPath, currently => {
                selectingState = {
                    selecting: {
                        'chart-timeline-grid-rows': [],
                        'chart-timeline-grid-row-blocks': [],
                        'chart-timeline-items-rows': [],
                        'chart-timeline-items-row-items': []
                    },
                    selected: currently.selected
                };
                return selectingState;
            });
        }
        else {
            state.update(pluginPath, currently => {
                selectingState = {
                    selecting: {
                        'chart-timeline-grid-rows': [],
                        'chart-timeline-grid-row-blocks': [],
                        'chart-timeline-items-rows': [],
                        'chart-timeline-items-row-items': []
                    },
                    selected: {
                        'chart-timeline-grid-rows': clear
                            ? []
                            : options.canDeselect('chart-timeline-grid-rows', currently.selected['chart-timeline-grid-rows'], currently),
                        'chart-timeline-grid-row-blocks': clear
                            ? []
                            : options.canDeselect('chart-timeline-grid-row-blocks', currently.selected['chart-timeline-grid-row-blocks'], currently),
                        'chart-timeline-items-rows': clear
                            ? []
                            : options.canDeselect('chart-timeline-items-rows', currently.selected['chart-timeline-items-rows'], currently),
                        'chart-timeline-items-row-items': clear
                            ? []
                            : options.canDeselect('chart-timeline-items-row-items', currently.selected['chart-timeline-items-row-items'], currently)
                    }
                };
                return selectingState;
            });
            state.update('_internal.chart.grid.rowsWithBlocks', function clearRowsWithBlocks(rowsWithBlocks) {
                if (rowsWithBlocks)
                    for (const row of rowsWithBlocks) {
                        for (const block of row.blocks) {
                            block.selected = selectingState.selected['chart-timeline-grid-row-blocks'].includes(block.id);
                            block.selecting = false;
                        }
                    }
                return rowsWithBlocks;
            });
            state.update('config.chart.items', items => {
                if (items) {
                    for (const itemId in items) {
                        const item = items[itemId];
                        item.selected = selectingState.selected['chart-timeline-items-row-items'].includes(itemId);
                        item.selecting = false;
                    }
                }
                return items;
            });
        }
    }
    let previousSelect;
    function markSelected(addToPrevious = false) {
        selecting.selecting = false;
        rect.style.visibility = 'hidden';
        const currentSelect = cloneSelection(state.get(pluginPath));
        const select = {};
        if (addToPrevious) {
            state.update(pluginPath, value => {
                const selected = Object.assign({}, value.selecting);
                for (const name in value.selected) {
                    for (const id of selected[name]) {
                        if (!value.selected[name].includes(id)) {
                            value.selected[name].push(id);
                        }
                    }
                }
                select.selected = Object.assign({}, value.selected);
                select.selecting = getEmptyContainer();
                return select;
            });
        }
        else {
            state.update(pluginPath, value => {
                select.selected = Object.assign({}, value.selecting);
                select.selecting = getEmptyContainer();
                return select;
            });
        }
        const elements = state.get('_internal.elements');
        for (const type in selectionTypesIdGetters) {
            if (elements[type + 's'])
                for (const element of elements[type + 's']) {
                    if (currentSelect.selecting[type + 's'].includes(element.vido.id)) {
                        options.deselecting(element.vido, type);
                    }
                }
        }
        state.update('config.chart.items', function updateItems(items) {
            for (const itemId in items) {
                const item = items[itemId];
                if (currentSelect.selecting['chart-timeline-items-row-items'].includes(item.id)) {
                    item.selected = true;
                    if (typeof item.selected === 'undefined' || !item.selected) {
                        options.selected(item, 'chart-timeline-items-row-item');
                    }
                }
                else if (addToPrevious && previousSelect.selected['chart-timeline-items-row-items'].includes(item.id)) {
                    item.selected = true;
                }
                else {
                    item.selected = false;
                    if (currentSelect.selected['chart-timeline-items-row-items'].includes(item.id)) {
                        options.deselected(item, 'chart-timeline-items-row-item');
                    }
                }
            }
            return items;
        });
        state.update('_internal.chart.grid.rowsWithBlocks', function updateRowsWithBlocks(rowsWithBlocks) {
            if (rowsWithBlocks)
                for (const row of rowsWithBlocks) {
                    for (const block of row.blocks) {
                        if (currentSelect.selecting['chart-timeline-grid-row-blocks'].includes(block.id)) {
                            if (typeof block.selected === 'undefined' || !block.selected) {
                                options.selected(block, 'chart-timeline-grid-row-block');
                            }
                            block.selected = true;
                        }
                        else if (addToPrevious && previousSelect.selected['chart-timeline-grid-row-blocks'].includes(block.id)) {
                            block.selected = true;
                        }
                        else {
                            if (currentSelect.selected['chart-timeline-grid-row-blocks'].includes(block.id)) {
                                options.deselected(block, 'chart-timeline-grid-row-block');
                            }
                            block.selected = false;
                        }
                    }
                }
            return rowsWithBlocks;
        });
    }
    /**
     * Clone current selection state
     * @param {object} currentSelect
     * @returns {object} currentSelect cloned
     */
    function cloneSelection(currentSelect) {
        const result = {};
        result.selecting = Object.assign({}, currentSelect.selecting);
        result.selecting['chart-timeline-grid-rows'] = currentSelect.selecting['chart-timeline-grid-rows'].slice();
        result.selecting['chart-timeline-grid-row-blocks'] = currentSelect.selecting['chart-timeline-grid-row-blocks'].slice();
        result.selecting['chart-timeline-items-rows'] = currentSelect.selecting['chart-timeline-items-rows'].slice();
        result.selecting['chart-timeline-items-row-items'] = currentSelect.selecting['chart-timeline-items-row-items'].slice();
        result.selected = Object.assign({}, currentSelect.selected);
        result.selected['chart-timeline-grid-rows'] = currentSelect.selected['chart-timeline-grid-rows'].slice();
        result.selected['chart-timeline-grid-row-blocks'] = currentSelect.selected['chart-timeline-grid-row-blocks'].slice();
        result.selected['chart-timeline-items-rows'] = currentSelect.selected['chart-timeline-items-rows'].slice();
        result.selected['chart-timeline-items-row-items'] = currentSelect.selected['chart-timeline-items-row-items'].slice();
        return result;
    }
    /**
     * Selection action class
     */
    class SelectionAction extends Action {
        /**
         * Selection action constructor
         * @param {Element} element
         * @param {object|any} data
         */
        constructor(element, data) {
            super();
            const api = {};
            api.clearSelection = clearSelection;
            this.unsub = data.state.subscribeAll(['_internal.elements.chart-timeline', '_internal.chart.dimensions.width'], bulk => {
                const chartTimeline = state.get('_internal.elements.chart-timeline');
                if (chartTimeline === undefined)
                    return;
                this.chartTimeline = chartTimeline;
                if (!this.chartTimeline.querySelector('.' + rectClassName)) {
                    this.chartTimeline.insertAdjacentElement('beforeend', rect);
                }
                const bounding = this.chartTimeline.getBoundingClientRect();
                this.left = bounding.left;
                this.top = bounding.top;
            });
            /**
             * Save and swap coordinates if needed
             * @param {MouseEvent} ev
             */
            const saveAndSwapIfNeeded = (ev) => {
                const normalized = vido.api.normalizePointerEvent(ev);
                const currentX = normalized.x - this.left;
                const currentY = normalized.y - this.top;
                if (currentX <= selecting.startX) {
                    selecting.fromX = currentX;
                    selecting.toX = selecting.startX;
                }
                else {
                    selecting.fromX = selecting.startX;
                    selecting.toX = currentX;
                }
                if (currentY <= selecting.startY) {
                    selecting.fromY = currentY;
                    selecting.toY = selecting.startY;
                }
                else {
                    selecting.fromY = selecting.startY;
                    selecting.toY = currentY;
                }
            };
            /**
             * Is rectangle inside other rectangle ?
             * @param {DOMRect} boundingRect
             * @param {DOMRect} rectBoundingRect
             * @returns {boolean}
             */
            const isInside = (boundingRect, rectBoundingRect) => {
                let horizontal = false;
                let vertical = false;
                if ((boundingRect.left > rectBoundingRect.left && boundingRect.left < rectBoundingRect.right) ||
                    (boundingRect.right > rectBoundingRect.left && boundingRect.right < rectBoundingRect.right) ||
                    (boundingRect.left <= rectBoundingRect.left && boundingRect.right >= rectBoundingRect.right)) {
                    horizontal = true;
                }
                if ((boundingRect.top > rectBoundingRect.top && boundingRect.top < rectBoundingRect.bottom) ||
                    (boundingRect.bottom > rectBoundingRect.top && boundingRect.bottom < rectBoundingRect.bottom) ||
                    (boundingRect.top <= rectBoundingRect.top && boundingRect.bottom >= rectBoundingRect.bottom)) {
                    vertical = true;
                }
                return horizontal && vertical;
            };
            /**
             * Get selecting elements
             * @param {DOMRect} rectBoundingRect
             * @param {Element[]} elements
             * @param {string} type
             * @returns {string[]}
             */
            function getSelecting(rectBoundingRect, elements, type, getId) {
                const selectingResult = [];
                const currentlySelectingData = [];
                const all = elements[type + 's'];
                if (!all)
                    return [];
                const currentAll = state.get(pluginPath);
                const currentSelecting = currentAll.selecting[type + 's'];
                for (const element of all) {
                    const boundingRect = element.getBoundingClientRect();
                    if (isInside(boundingRect, rectBoundingRect)) {
                        currentlySelectingData.push(element.vido);
                        const canSelect = options.canSelect(type, currentlySelectingData, currentAll);
                        if (canSelect.includes(element.vido)) {
                            if (!currentSelecting.includes(getId(element.vido))) {
                                options.selecting(element.vido, type);
                            }
                            selectingResult.push(getId(element.vido));
                        }
                        else {
                            currentlySelectingData.unshift();
                        }
                    }
                    else {
                        if (currentSelecting.includes(getId(element.vido))) {
                            options.deselecting(element.vido, type);
                        }
                    }
                }
                return selectingResult;
            }
            function trackSelection(ev, virtually = false) {
                const movement = state.get('config.plugin.ItemMovement.movement');
                const moving = movement && (movement.moving || movement.waiting);
                if (!selecting.selecting || moving) {
                    if (moving) {
                        selecting.selecting = false;
                    }
                    return;
                }
                clearSelection(false, true);
                saveAndSwapIfNeeded(ev);
                rect.style.left = selecting.fromX + 'px';
                rect.style.top = selecting.fromY + 'px';
                rect.style.width = selecting.toX - selecting.fromX + 'px';
                rect.style.height = selecting.toY - selecting.fromY + 'px';
                if (!virtually) {
                    rect.style.visibility = 'visible';
                }
                const rectBoundingRect = rect.getBoundingClientRect();
                const elements = state.get('_internal.elements');
                const nowSelecting = {};
                for (const type in selectionTypesIdGetters) {
                    nowSelecting[type + 's'] = getSelecting(rectBoundingRect, elements, type, selectionTypesIdGetters[type]);
                }
                markSelecting(nowSelecting, ev.ctrlKey);
            }
            /**
             * End select
             * @param {Event} ev
             */
            const endSelect = ev => {
                if (selecting.selecting) {
                    ev.stopPropagation();
                    ev.preventDefault();
                    const normalized = vido.api.normalizePointerEvent(ev);
                    if (selecting.startX === normalized.x - this.left && selecting.startY === normalized.y - this.top) {
                        selecting.selecting = false;
                        rect.style.visibility = 'hidden';
                        return;
                    }
                }
                else {
                    const itemClass = '.gantt-schedule-timeline-calendar__chart-timeline-items-row-item';
                    const isItem = !!ev.target.closest(itemClass);
                    if (!isItem) {
                        if (!ev.ctrlKey)
                            clearSelection();
                    }
                    else {
                        markSelected(ev.ctrlKey);
                    }
                    return;
                }
                markSelected(ev.ctrlKey);
            };
            /**
             * Mouse down event handler
             * @param {MouseEvent} ev
             */
            this.mouseDown = ev => {
                const movement = state.get('config.plugin.ItemMovement.movement');
                const moving = movement && movement.moving;
                if ((ev.type === 'mousedown' && ev.button !== 0) || moving) {
                    return;
                }
                const normalized = vido.api.normalizePointerEvent(ev);
                selecting.selecting = true;
                selecting.fromX = normalized.x - this.left;
                selecting.fromY = normalized.y - this.top;
                selecting.startX = selecting.fromX;
                selecting.startY = selecting.fromY;
                previousSelect = cloneSelection(state.get(pluginPath));
                const itemClass = '.gantt-schedule-timeline-calendar__chart-timeline-items-row-item';
                const isItem = !!ev.target.closest(itemClass);
                if (!isItem) {
                    if (!ev.ctrlKey)
                        clearSelection();
                }
            };
            /**
             * Mouse move event handler
             * @param {MouseEvent} ev
             */
            this.mouseMove = ev => {
                trackSelection(ev);
            };
            /**
             * Mouse up event handler
             * @param {MouseEvent} ev
             */
            this.mouseUp = ev => {
                if (selecting.selecting) {
                    endSelect(ev);
                }
            };
            element.addEventListener('mousedown', this.mouseDown);
            element.addEventListener('touchstart', this.mouseDown);
            document.addEventListener('mousemove', this.mouseMove);
            document.addEventListener('touchmove', this.mouseMove);
            document.addEventListener('mouseup', this.mouseUp);
            document.addEventListener('touchend', this.mouseUp);
            options.getApi(api);
        }
        destroy(element) {
            document.removeEventListener('mouseup', this.mouseUp);
            document.removeEventListener('touchend', this.mouseUp);
            document.removeEventListener('mousemove', this.mouseMove);
            document.removeEventListener('touchmove', this.mouseMove);
            element.removeEventListener('mousedown', this.mouseDown);
            element.removeEventListener('touchstart', this.mouseDown);
            this.unsub();
        }
    }
    /**
     * Update selection
     * @param {any} data
     * @param {HTMLElement} element
     * @param {boolean} selecting
     * @param {boolean} selected
     * @param {string} classNameSelecting
     * @param {string} classNameSelected
     */
    function updateSelection(element, selecting, selected, classNameSelecting, classNameSelected) {
        if (selecting && !element.classList.contains(classNameSelecting)) {
            element.classList.add(classNameSelecting);
        }
        else if (!selecting && element.classList.contains(classNameSelecting)) {
            element.classList.remove(classNameSelecting);
        }
        if (selected && !element.classList.contains(classNameSelected)) {
            element.classList.add(classNameSelected);
        }
        else if (!selected && element.classList.contains(classNameSelected)) {
            element.classList.remove(classNameSelected);
        }
    }
    /**
     * Grid row block action
     * @param {HTMLElement} element
     * @param {object} data
     * @returns {object} with update and destroy functions
     */
    class GridBlockAction extends Action {
        constructor(element, data) {
            super();
            this.classNameSelecting = api.getClass('chart-timeline-grid-row-block') + '--selecting';
            this.classNameSelected = api.getClass('chart-timeline-grid-row-block') + '--selected';
            updateSelection(element, data.selecting, data.selected, this.classNameSelecting, this.classNameSelected);
        }
        update(element, data) {
            updateSelection(element, data.selecting, data.selected, this.classNameSelecting, this.classNameSelected);
        }
        destroy(element, changedData) {
            element.classList.remove(this.classNameSelecting);
            element.classList.remove(this.classNameSelected);
        }
    }
    /**
     * Item action
     * @param {Element} element
     * @param {object} data
     * @returns {object} with update and destroy functions
     */
    class ItemAction extends Action {
        constructor(element, data) {
            super();
            this.data = data;
            this.element = element;
            this.classNameSelecting = api.getClass('chart-timeline-items-row-item') + '--selecting';
            this.classNameSelected = api.getClass('chart-timeline-items-row-item') + '--selected';
            this.data = data;
            this.element = element;
            this.onPointerDown = this.onPointerDown.bind(this);
            element.addEventListener('mousedown', this.onPointerDown);
            element.addEventListener('touchstart', this.onPointerDown);
            updateSelection(element, data.item.selecting, data.item.selected, this.classNameSelecting, this.classNameSelected);
        }
        onPointerDown(ev) {
            previousSelect = cloneSelection(state.get(pluginPath));
            selecting.selecting = true;
            this.data.item.selected = true;
            const container = getEmptyContainer();
            container['chart-timeline-items-row-items'].push(this.data.item.id);
            markSelecting(container);
            markSelected(ev.ctrlKey);
            updateSelection(this.element, this.data.item.selecting, this.data.item.selected, this.classNameSelecting, this.classNameSelected);
        }
        update(element, data) {
            updateSelection(element, data.item.selecting, data.item.selected, this.classNameSelecting, this.classNameSelected);
            this.data = data;
        }
        destroy(element, data) {
            element.classList.remove(this.classNameSelecting);
            element.classList.remove(this.classNameSelected);
            element.removeEventListener('mousedown', this.onPointerDown);
            element.removeEventListener('touchstart', this.onPointerDown);
        }
    }
    /**
     * On block create handler
     * @param {object} block
     * @returns {object} block
     */
    function onBlockCreate(block) {
        const selectedBlocks = state.get('config.plugin.selection.selected.chart-timeline-grid-row-blocks');
        for (const selectedBlock of selectedBlocks) {
            if (selectedBlock === block.id) {
                block.selected = true;
                return block;
            }
        }
        block.selected = false;
        block.selecting = false;
        return block;
    }
    return function initialize(mainVido) {
        vido = mainVido;
        state = vido.state;
        api = vido.api;
        schedule = vido.schedule;
        if (typeof state.get(pluginPath) === 'undefined') {
            state.update(pluginPath, {
                selecting: {
                    'chart-timeline-grid-rows': [],
                    'chart-timeline-grid-row-blocks': [],
                    'chart-timeline-items-rows': [],
                    'chart-timeline-items-row-items': []
                },
                selected: {
                    'chart-timeline-grid-rows': [],
                    'chart-timeline-grid-row-blocks': [],
                    'chart-timeline-items-rows': [],
                    'chart-timeline-items-row-items': []
                }
            });
        }
        state.update('config.chart.items', items => {
            if (items)
                for (const itemId in items) {
                    const item = items[itemId];
                    if (typeof item.selecting === 'undefined') {
                        item.selecting = false;
                    }
                    if (typeof item.selected === 'undefined') {
                        item.selected = false;
                    }
                }
            return items;
        });
        state.update('config.actions.chart-timeline', actions => {
            actions.push(SelectionAction);
            return actions;
        });
        state.update('config.actions.chart-timeline-grid-row-block', actions => {
            actions.push(GridBlockAction);
            return actions;
        });
        state.update('config.actions.chart-timeline-items-row-item', actions => {
            actions.push(ItemAction);
            return actions;
        });
        state.update('config.chart.grid.block.onCreate', onCreate => {
            onCreate.push(onBlockCreate);
            return onCreate;
        });
    };
}

/**
 * CalendarScroll plugin
 *
 * @copyright Rafal Pospiech <https://neuronet.io>
 * @author    Rafal Pospiech <neuronet.io@gmail.com>
 * @package   gantt-schedule-timeline-calendar
 * @license   AGPL-3.0 (https://github.com/neuronetio/gantt-schedule-timeline-calendar/blob/master/LICENSE)
 * @link      https://github.com/neuronetio/gantt-schedule-timeline-calendar
 */
const defaultOptions$1 = {
    enabled: true
};
function CalendarScroll(options = defaultOptions$1) {
    let vido, api, state;
    let enabled = options.enabled;
    class ChartAction {
        constructor(element) {
            this.moving = false;
            this.initialDataIndex = { x: 0, y: 0 };
            this.lastPos = 0;
            this.pointerDown = this.pointerDown.bind(this);
            this.pointerUp = this.pointerUp.bind(this);
            this.pointerMove = vido.schedule(this.pointerMove.bind(this));
            element.addEventListener('pointerdown', this.pointerDown);
            document.addEventListener('pointermove', this.pointerMove, { passive: true });
            document.addEventListener('pointerup', this.pointerUp);
            element.style.cursor = 'grab';
        }
        destroy(element) {
            element.removeEventListener('pointerdown', this.pointerDown);
            document.removeEventListener('pointermove', this.pointerMove);
            document.removeEventListener('pointerup', this.pointerUp);
        }
        resetInitialPoint(ev) {
            this.initialPoint = { x: ev.screenX, y: ev.screenY };
        }
        pointerDown(ev) {
            if (!enabled)
                return;
            this.moving = true;
            this.resetInitialPoint(ev);
            const scroll = state.get('config.scroll');
            this.initialDataIndex = { x: scroll.horizontal.dataIndex || 0, y: scroll.vertical.dataIndex || 0 };
        }
        pointerUp(ev) {
            if (!enabled)
                return;
            if (this.moving) {
                this.moving = false;
            }
        }
        handleHorizontalMovement(diff, ev) {
            const time = state.get('_internal.chart.time');
            if (diff.x > 0) {
                // go backward - move dates forward
                if (this.initialDataIndex.x === 0) {
                    return this.resetInitialPoint(ev);
                }
                const allDates = time.allDates[time.level];
                let i = this.initialDataIndex.x - 1;
                let width = 0;
                for (; i > 0; i--) {
                    const date = allDates[i];
                    width += date.width;
                    if (width >= diff.x)
                        break;
                }
                api.scrollToTime(allDates[i].leftGlobal, false);
            }
            else if (diff.x < 0) {
                // go forward - move dates backward
                let i = this.initialDataIndex.x;
                const hScroll = state.get('config.scroll.horizontal');
                const allDates = time.allDates[time.level];
                if (i - 1 >= allDates.length - hScroll.lastPageCount) {
                    return this.resetInitialPoint(ev);
                }
                let width = 0;
                for (let len = allDates.length; i < len; i++) {
                    const date = allDates[i];
                    width += date.width;
                    if (-width <= diff.x)
                        break;
                }
                if (i - 1 >= allDates.length - hScroll.lastPageCount) {
                    return;
                }
                api.scrollToTime(allDates[i].leftGlobal, false);
            }
        }
        pointerMove(ev) {
            if (!enabled || !this.moving)
                return;
            const diffX = ev.screenX - this.initialPoint.x;
            const diffY = ev.screenY - this.initialPoint.y;
            const diff = { x: diffX, y: diffY };
            this.handleHorizontalMovement(diff, ev);
        }
    }
    return function initialize(vidoInstance) {
        vido = vidoInstance;
        api = vido.api;
        state = vido.state;
        state.update('config.plugin.CalendarScroll', options);
        state.subscribe('config.plugin.CalendarScroll.enabled', value => (enabled = value));
        state.update('config.actions.chart-calendar', chartActions => {
            chartActions.push(ChartAction);
            return chartActions;
        });
    };
}

/**
 * Weekend highlight plugin
 *
 * @copyright Rafal Pospiech <https://neuronet.io>
 * @author    Rafal Pospiech <neuronet.io@gmail.com>
 * @package   gantt-schedule-timeline-calendar
 * @license   AGPL-3.0 (https://github.com/neuronetio/gantt-schedule-timeline-calendar/blob/master/LICENSE)
 * @link      https://github.com/neuronetio/gantt-schedule-timeline-calendar
 */
function WeekendHiglight(options = {}) {
    const weekdays = options.weekdays || [6, 0];
    let className;
    let api;
    let enabled = true;
    class WeekendHighlightAction extends Action {
        constructor(element, data) {
            super();
            this.highlight(element, data.time.leftGlobal);
        }
        update(element, data) {
            this.highlight(element, data.time.leftGlobal);
        }
        highlight(element, time) {
            const hasClass = element.classList.contains(className);
            if (!enabled) {
                if (hasClass) {
                    element.classList.remove(className);
                }
                return;
            }
            const isWeekend = weekdays.includes(api.time.date(time).day());
            if (!hasClass && isWeekend) {
                element.classList.add(className);
            }
            else if (hasClass && !isWeekend) {
                element.classList.remove(className);
            }
        }
    }
    return function initialize(vido) {
        api = vido.api;
        className = options.className || api.getClass('chart-timeline-grid-row-block') + '--weekend';
        const destroy = vido.state.subscribe('_internal.chart.time.format.period', period => (enabled = period === 'day'));
        vido.state.update('config.actions.chart-timeline-grid-row-block', actions => {
            actions.push(WeekendHighlightAction);
            return actions;
        });
        return function onDestroy() {
            destroy();
        };
    };
}

var plugins = { ItemHold, ItemMovement, Selection, CalendarScroll, WeekendHighlight: WeekendHiglight };

export default plugins;
//# sourceMappingURL=plugins.js.map
