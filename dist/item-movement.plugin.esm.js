/**
 * Schedule - a throttle function that uses requestAnimationFrame to limit the rate at which a function is called.
 *
 * @param {function} fn
 * @returns {function}
 */
/**
 * Is object - helper function to determine if specified variable is an object
 *
 * @param {any} item
 * @returns {boolean}
 */
function isObject(item) {
    return item && typeof item === 'object' && item.constructor && item.constructor.name === 'Object';
}
/**
 * Merge deep - helper function which will merge objects recursively - creating brand new one - like clone
 *
 * @param {object} target
 * @params {[object]} sources
 * @returns {object}
 */
function mergeDeep(target, ...sources) {
    const source = sources.shift();
    if (isObject(target) && isObject(source)) {
        for (const key in source) {
            if (isObject(source[key])) {
                if (typeof source[key].clone === 'function') {
                    target[key] = source[key].clone();
                }
                else {
                    if (typeof target[key] === 'undefined') {
                        target[key] = {};
                    }
                    target[key] = mergeDeep(target[key], source[key]);
                }
            }
            else if (Array.isArray(source[key])) {
                target[key] = new Array(source[key].length);
                let index = 0;
                for (let item of source[key]) {
                    if (isObject(item)) {
                        if (typeof item.clone === 'function') {
                            target[key][index] = item.clone();
                        }
                        else {
                            target[key][index] = mergeDeep({}, item);
                        }
                    }
                    else {
                        target[key][index] = item;
                    }
                    index++;
                }
            }
            else {
                target[key] = source[key];
            }
        }
    }
    if (!sources.length) {
        return target;
    }
    return mergeDeep(target, ...sources);
}

/**
 * TimelinePointer plugin
 *
 * @copyright Rafal Pospiech <https://neuronet.io>
 * @author    Rafal Pospiech <neuronet.io@gmail.com>
 * @package   gantt-schedule-timeline-calendar
 * @license   AGPL-3.0 (https://github.com/neuronetio/gantt-schedule-timeline-calendar/blob/master/LICENSE)
 * @link      https://github.com/neuronetio/gantt-schedule-timeline-calendar
 */
const ITEM = 'chart-timeline-items-row-item';

/**
 * ItemMovement plugin
 *
 * @copyright Rafal Pospiech <https://neuronet.io>
 * @author    Rafal Pospiech <neuronet.io@gmail.com>
 * @package   gantt-schedule-timeline-calendar
 * @license   AGPL-3.0 (https://github.com/neuronetio/gantt-schedule-timeline-calendar/blob/master/LICENSE)
 * @link      https://github.com/neuronetio/gantt-schedule-timeline-calendar
 */
function prepareOptions(options) {
    return Object.assign({ enabled: true, className: '', bodyClass: 'gstc-item-movement', bodyClassMoving: 'gstc-items-moving' }, options);
}
const pluginPath = 'config.plugin.ItemMovement';
function generateEmptyPluginData(options) {
    const events = {
        onStart({ items }) {
            return items.after;
        },
        onMove({ items }) {
            return items.after;
        },
        onEnd({ items }) {
            return items.after;
        }
    };
    const snapToTime = {
        start({ startTime, time }) {
            return startTime.startOf(time.period);
        },
        end({ endTime, time }) {
            return endTime.endOf(time.period);
        }
    };
    const result = Object.assign({ debug: false, moving: [], targetData: null, initialItems: [], pointerState: 'up', pointerMoved: false, state: '', position: { x: 0, y: 0 }, movement: {
            px: { horizontal: 0, vertical: 0 },
            time: 0
        }, lastMovement: { x: 0, y: 0, time: 0 }, events: Object.assign({}, events), snapToTime: Object.assign({}, snapToTime) }, options);
    if (options.snapToTime) {
        result.snapToTime = Object.assign(Object.assign({}, snapToTime), options.snapToTime);
    }
    if (options.events) {
        result.events = Object.assign(Object.assign({}, events), options.events);
    }
    return result;
}
class ItemMovement {
    constructor(vido) {
        this.onDestroy = [];
        this.cumulations = {};
        this.relativeVerticalPosition = {};
        this.vido = vido;
        this.api = vido.api;
        this.state = vido.state;
        this.merge = this.state.get('config.merge');
        this.destroy = this.destroy.bind(this);
        this.onDestroy.push(this.state.subscribe(pluginPath, data => {
            this.data = data;
            if (!data.enabled) {
                document.body.classList.remove(this.data.bodyClass);
            }
            else {
                document.body.classList.add(this.data.bodyClass);
            }
        }));
        if (!this.data.className)
            this.data.className = this.api.getClass('chart-timeline-items-row-item--moving');
        this.onSelectionChange = this.onSelectionChange.bind(this);
        this.onDestroy.push(this.state.subscribe('config.plugin.Selection', this.onSelectionChange));
    }
    destroy() {
        this.onDestroy.forEach(unsub => unsub());
    }
    updateData() {
        this.state.update(pluginPath, Object.assign({}, this.data));
    }
    clearCumulationsForItems() {
        this.cumulations = {};
    }
    setStartCumulationForItem(item, cumulation) {
        if (!this.cumulations[item.id]) {
            this.cumulations[item.id] = { start: 0, end: 0 };
        }
        this.cumulations[item.id].start = cumulation;
    }
    getStartCumulationForItem(item) {
        var _a;
        return ((_a = this.cumulations[item.id]) === null || _a === void 0 ? void 0 : _a.start) || 0;
    }
    getItemMovingTimes(item, time) {
        const horizontal = this.data.movement.px.horizontal;
        const positionLeft = this.api.time.getViewOffsetPxFromDates(item.$data.time.startDate, false, time);
        const x = positionLeft + horizontal + this.getStartCumulationForItem(item);
        const leftGlobal = this.api.time.getTimeFromViewOffsetPx(x, time);
        const startTime = this.data.snapToTime.start({
            startTime: this.api.time.date(leftGlobal),
            item,
            time,
            movement: this.data.movement,
            vido: this.vido
        });
        const snapStartPxDiff = this.api.time.getDatesDiffPx(startTime, this.api.time.date(leftGlobal), time, true);
        this.setStartCumulationForItem(item, snapStartPxDiff);
        const startEndTimeDiff = item.$data.time.endDate.diff(item.$data.time.startDate, 'millisecond');
        // diff could be too much if we are in the middle of european summer time (daylight-saving time)
        const rightGlobal = startTime.add(startEndTimeDiff, 'millisecond').valueOf();
        const rightGlobalDate = this.api.time.date(rightGlobal);
        /* // summer time / daylight saving time bug
        const leftFmt = rightGlobalDate.format('YYYY-MM-DD HH:mm:ss');
        const rightFmt = rightGlobalDate.endOf(time.period).format('YYYY-MM-DD HH:mm:ss');
        if (leftFmt !== rightFmt) {
          console.log('no match', leftFmt, rightFmt);
        }*/
        const endTime = this.data.snapToTime.end({
            endTime: rightGlobalDate,
            item,
            time,
            movement: this.data.movement,
            vido: this.vido
        });
        return { startTime, endTime };
    }
    findRowAtViewPosition(y, currentRow) {
        const visibleRowsId = this.state.get('$data.list.visibleRows');
        const visibleRows = this.api.getRows(visibleRowsId);
        for (const row of visibleRows) {
            const rowBottom = row.$data.position.viewTop + row.$data.outerHeight;
            if (row.$data.position.viewTop <= y && rowBottom >= y)
                return row;
        }
        return currentRow;
    }
    getItemViewTop(item) {
        const rows = this.state.get('config.list.rows');
        const row = rows[item.rowId];
        return row.$data.position.viewTop + item.$data.position.actualTop;
    }
    saveItemsRelativeVerticalPosition() {
        for (const item of this.data.moving) {
            const relativePosition = this.data.position.y - this.getItemViewTop(item);
            this.setItemRelativeVerticalPosition(item, relativePosition);
        }
    }
    setItemRelativeVerticalPosition(item, relativePosition) {
        this.relativeVerticalPosition[item.id] = relativePosition;
    }
    getItemRelativeVerticalPosition(item) {
        return this.relativeVerticalPosition[item.id];
    }
    moveItemVertically(item) {
        const rows = this.state.get('config.list.rows');
        const currentRow = rows[item.rowId];
        const relativePosition = this.getItemRelativeVerticalPosition(item);
        const itemShouldBeAt = this.data.position.y + relativePosition;
        return this.findRowAtViewPosition(itemShouldBeAt, currentRow);
    }
    getEventArgument(afterItems) {
        const configItems = this.state.get('config.chart.items');
        const before = [];
        for (const item of afterItems) {
            before.push(this.merge({}, configItems[item.id]));
        }
        return {
            items: {
                initial: this.data.initialItems,
                before,
                after: afterItems,
                targetData: this.merge({}, this.data.targetData)
            },
            vido: this.vido,
            state: this.state,
            time: this.state.get('$data.chart.time')
        };
    }
    moveItems() {
        if (!this.data.enabled)
            return;
        const time = this.state.get('$data.chart.time');
        const moving = this.data.moving.map(item => this.merge({}, item));
        if (this.data.debug)
            console.log('moveItems', moving); // eslint-disable-line no-console
        for (let item of moving) {
            item.rowId = this.moveItemVertically(item).id;
            const newItemTimes = this.getItemMovingTimes(item, time);
            if (newItemTimes.startTime.valueOf() !== item.time.start || newItemTimes.endTime.valueOf() !== item.time.end) {
                item.time.start = newItemTimes.startTime.valueOf();
                item.time.end = newItemTimes.endTime.valueOf();
                item.$data.time.startDate = newItemTimes.startTime;
                item.$data.time.endDate = newItemTimes.endTime;
            }
        }
        this.dispatchEvent('onMove', moving);
    }
    clearSelection() {
        this.data.moving = [];
        this.data.initialItems = [];
        this.data.movement.px.horizontal = 0;
        this.data.movement.px.vertical = 0;
        this.data.movement.time = 0;
        this.data.pointerState = 'up';
        this.data.pointerMoved = false;
    }
    dispatchEvent(type, items) {
        items = items.map(item => this.merge({}, item));
        const modified = this.data.events[type](this.getEventArgument(items));
        let multi = this.state.multi();
        for (const item of modified) {
            multi = multi.update(`config.chart.items.${item.id}`, currentItem => {
                // items should be always references - we cannot make a copy of the object because it may lead us to troubles
                mergeDeep(currentItem, item);
                return currentItem;
            });
        }
        multi.done();
        this.data.moving = modified;
    }
    onStart() {
        this.data.initialItems = this.data.moving.map(item => this.merge({}, item));
        this.clearCumulationsForItems();
        document.body.classList.add(this.data.bodyClassMoving);
        this.data.position = Object.assign({}, this.selection.currentPosition);
        this.data.lastMovement.time = this.data.moving[0].time.start;
        this.saveItemsRelativeVerticalPosition();
        const initial = this.data.initialItems.map(item => this.merge({}, item));
        this.dispatchEvent('onStart', initial);
    }
    onEnd() {
        const moving = this.data.moving.map(item => this.merge({}, item));
        this.dispatchEvent('onEnd', moving);
        document.body.classList.remove(this.data.bodyClassMoving);
        this.clearSelection();
        this.clearCumulationsForItems();
    }
    onSelectionChange(data) {
        if (!this.data.enabled)
            return;
        this.selection = Object.assign({}, data);
        if (this.selection.targetType !== ITEM) {
            return this.clearSelection();
        }
        if (this.data.pointerState === 'up' && this.selection.pointerState === 'down') {
            this.data.state = 'start';
        }
        else if ((this.data.pointerState === 'down' || this.data.pointerState === 'move') &&
            this.selection.pointerState === 'up') {
            this.data.state = 'end';
        }
        else if (this.selection.pointerState === 'move') {
            this.data.state = 'move';
        }
        else {
            this.data.state = '';
            return this.updateData();
        }
        if (this.selection.events.move) {
            this.selection.events.move.preventDefault();
            this.selection.events.move.stopPropagation();
        }
        if (this.selection.events.down) {
            this.selection.events.down.preventDefault();
            this.selection.events.down.stopPropagation();
        }
        this.data.pointerState = this.selection.pointerState;
        this.data.targetData = Object.assign({}, this.selection.targetData);
        if (this.data.state === 'end')
            this.onEnd(); // before this.selection.selected[ITEM] clear
        this.data.moving = this.selection.selected[ITEM].map(item => this.merge({}, item));
        if (this.data.debug)
            console.log('state', this.data.pointerState); // eslint-disable-line no-console
        if (this.data.state === 'start')
            this.onStart();
        if (this.data.state === 'move' || this.data.state === 'start') {
            this.data.lastMovement.x = this.data.movement.px.horizontal;
            this.data.lastMovement.y = this.data.movement.px.vertical;
            this.data.movement.px.horizontal = this.selection.currentPosition.x - this.data.position.x;
            this.data.movement.px.vertical = this.selection.currentPosition.y - this.data.position.y;
            this.data.movement.time = this.data.moving[0].time.start - this.data.lastMovement.time;
            this.data.position.x = this.selection.currentPosition.x;
            this.data.position.y = this.selection.currentPosition.y;
            this.data.lastMovement.time = this.data.moving[0].time.start;
        }
        if (this.data.state === 'move' &&
            this.data.lastMovement.x === this.data.movement.px.horizontal &&
            this.data.lastMovement.y === this.data.movement.px.vertical) {
            // prevent movement if there is no movement... (performance optimization)
            return this.updateData();
        }
        if (this.data.state === 'move')
            this.moveItems();
        this.updateData();
    }
}
function Plugin(options = {}) {
    return function initialize(vidoInstance) {
        const currentOptions = vidoInstance.state.get(pluginPath);
        if (currentOptions) {
            options = mergeDeep({}, options, currentOptions);
        }
        vidoInstance.state.update(pluginPath, generateEmptyPluginData(prepareOptions(options)));
        const itemMovement = new ItemMovement(vidoInstance);
        return itemMovement.destroy;
    };
}

export { Plugin };
//# sourceMappingURL=item-movement.plugin.esm.js.map
