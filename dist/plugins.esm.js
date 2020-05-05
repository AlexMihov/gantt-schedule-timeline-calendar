/**
 * TimelinePointer plugin
 *
 * @copyright Rafal Pospiech <https://neuronet.io>
 * @author    Rafal Pospiech <neuronet.io@gmail.com>
 * @package   gantt-schedule-timeline-calendar
 * @license   AGPL-3.0 (https://github.com/neuronetio/gantt-schedule-timeline-calendar/blob/master/LICENSE)
 * @link      https://github.com/neuronetio/gantt-schedule-timeline-calendar
 */
const CELL = 'chart-timeline-grid-row-cell';
const ITEM = 'chart-timeline-items-row-item';
function generateEmptyData(options = {}) {
    const result = {
        enabled: true,
        isMoving: false,
        pointerState: 'up',
        currentTarget: null,
        realTarget: null,
        targetType: '',
        targetData: null,
        offset: { top: 0, left: 0 },
        captureEvents: {
            down: false,
            up: false,
            move: false,
        },
        initialPosition: { x: 0, y: 0 },
        currentPosition: { x: 0, y: 0 },
        events: {
            down: null,
            move: null,
            up: null,
        },
    };
    if (options.captureEvents) {
        result.captureEvents = Object.assign(Object.assign({}, result.captureEvents), options.captureEvents);
    }
    return result;
}
const pluginPath = 'config.plugin.TimelinePointer';
class TimelinePointer {
    constructor(options, vido) {
        this.unsub = [];
        this.classNames = {
            cell: '',
            item: '',
        };
        this.vido = vido;
        this.api = vido.api;
        this.state = vido.state;
        this.element = this.state.get(`$data.elements.chart-timeline`);
        this.pointerDown = this.pointerDown.bind(this);
        this.pointerMove = this.pointerMove.bind(this);
        this.pointerUp = this.pointerUp.bind(this);
        this.data = generateEmptyData(options);
        this.classNames.cell = this.api.getClass(CELL);
        this.classNames.item = this.api.getClass(ITEM);
        this.destroy = this.destroy.bind(this);
        this.element.addEventListener('pointerdown', this.pointerDown /*, this.data.captureEvents.down*/);
        document.addEventListener('pointerup', this.pointerUp /*, this.data.captureEvents.up*/);
        document.addEventListener('pointermove', this.pointerMove /*, this.data.captureEvents.move*/);
        this.unsub.push(this.state.subscribe(pluginPath, (value) => (this.data = value)));
        this.unsub.push(this.state.subscribe('config.scroll.vertical.offset', (offset) => {
            this.data.offset.left = offset;
            this.updateData();
        }));
    }
    destroy() {
        this.element.removeEventListener('pointerdown', this.pointerDown);
        document.removeEventListener('pointerup', this.pointerUp);
        document.removeEventListener('pointermove', this.pointerMove);
    }
    updateData() {
        this.state.update(pluginPath, () => (Object.assign({}, this.data)));
    }
    getRealTarget(ev) {
        let realTarget = ev.target.closest('.' + this.classNames.item);
        if (realTarget) {
            return realTarget;
        }
        realTarget = ev.target.closest('.' + this.classNames.cell);
        if (realTarget) {
            return realTarget;
        }
        return null;
    }
    getRealPosition(ev) {
        const pos = { x: 0, y: 0 };
        if (this.element) {
            const bounding = this.element.getBoundingClientRect();
            pos.x = ev.x - bounding.x;
            pos.y = ev.y - bounding.y;
            const scrollOffsetTop = this.state.get('config.scroll.vertical.offset') || 0;
            pos.y += scrollOffsetTop;
        }
        return pos;
    }
    pointerDown(ev) {
        if (!this.data.enabled)
            return;
        this.data.pointerState = 'down';
        this.data.currentTarget = ev.target;
        this.data.realTarget = this.getRealTarget(ev);
        if (this.data.realTarget) {
            if (this.data.realTarget.classList.contains(this.classNames.item)) {
                this.data.targetType = ITEM;
                // @ts-ignore
                this.data.targetData = this.data.realTarget.vido.item;
            }
            else if (this.data.realTarget.classList.contains(this.classNames.cell)) {
                this.data.targetType = CELL;
                // @ts-ignore
                this.data.targetData = this.data.realTarget.vido;
            }
            else {
                this.data.targetType = '';
            }
        }
        else {
            this.data.targetType = '';
            this.data.targetData = null;
        }
        this.data.isMoving = !!this.data.realTarget;
        this.data.events.down = ev;
        this.data.events.move = ev;
        const realPosition = this.getRealPosition(ev);
        this.data.initialPosition = realPosition;
        this.data.currentPosition = realPosition;
        this.updateData();
    }
    pointerUp(ev) {
        if (!this.data.enabled)
            return;
        this.data.pointerState = 'up';
        this.data.isMoving = false;
        this.data.events.up = ev;
        this.data.currentPosition = this.getRealPosition(ev);
        this.updateData();
    }
    pointerMove(ev) {
        if (!this.data.enabled || !this.data.isMoving)
            return;
        this.data.pointerState = 'move';
        this.data.events.move = ev;
        this.data.currentPosition = this.getRealPosition(ev);
        this.updateData();
    }
}
function Plugin(options) {
    return function initialize(vidoInstance) {
        const defaultData = generateEmptyData(options);
        // for other plugins that are initialized before elements are saved
        vidoInstance.state.update(pluginPath, defaultData);
        let timelinePointerDestroy;
        const unsub = vidoInstance.state.subscribe('$data.elements.chart-timeline', (timelineElement) => {
            if (timelineElement) {
                if (timelinePointerDestroy)
                    timelinePointerDestroy();
                const timelinePointer = new TimelinePointer(options, vidoInstance);
                timelinePointerDestroy = timelinePointer.destroy;
            }
        });
        return function destroy() {
            unsub();
            if (timelinePointerDestroy)
                timelinePointerDestroy();
        };
    };
}

var TimelinePointer$1 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  CELL: CELL,
  ITEM: ITEM,
  Plugin: Plugin
});

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
            holding[item.id] = { x: event.x, y: event.y };
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
        element.addEventListener('pointerdown', elementPointerDown);
        function pointerUp() {
            onPointerUp(data.item.id);
        }
        document.addEventListener('pointerup', pointerUp);
        function onPointerMove(event) {
            pointer.x = event.x;
            pointer.y = event.y;
        }
        document.addEventListener('pointermove', onPointerMove);
        return {
            update(element, changedData) {
                data = changedData;
            },
            destroy(element, data) {
                document.removeEventListener('pointerup', onPointerUp);
                document.removeEventListener('poitnermove', onPointerMove);
                element.removeEventListener('pointerdown', elementPointerDown);
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

var ItemHold$1 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  'default': ItemHold
});

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
    return item && typeof item === 'object' && !Array.isArray(item);
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
const pluginPath$1 = 'config.plugin.ItemMovement';
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
        },
    };
    const snapToTime = {
        start({ startTime, time }) {
            return startTime.startOf(time.period);
        },
        end({ endTime, time }) {
            return endTime.endOf(time.period);
        },
    };
    const result = Object.assign({ debug: false, moving: [], targetData: null, initialItems: [], pointerState: 'up', pointerMoved: false, state: '', position: { x: 0, y: 0 }, movement: {
            px: { horizontal: 0, vertical: 0 },
            time: 0,
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
        this.onDestroy.push(this.state.subscribe(pluginPath$1, (data) => {
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
        this.onDestroy.forEach((unsub) => unsub());
    }
    updateData() {
        this.state.update(pluginPath$1, Object.assign({}, this.data));
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
            vido: this.vido,
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
            vido: this.vido,
        });
        return { startTime, endTime };
    }
    findRowAtViewPosition(y, currentRow) {
        const visibleRows = this.state.get('$data.list.visibleRows');
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
                targetData: this.merge({}, this.data.targetData),
            },
            vido: this.vido,
            state: this.state,
            time: this.state.get('$data.chart.time'),
        };
    }
    moveItems() {
        if (!this.data.enabled)
            return;
        const time = this.state.get('$data.chart.time');
        const moving = this.data.moving.map((item) => this.merge({}, item));
        if (this.data.debug)
            console.log('moveItems', moving);
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
        items = items.map((item) => this.merge({}, item));
        const modified = this.data.events[type](this.getEventArgument(items));
        let multi = this.state.multi();
        for (const item of modified) {
            multi = multi.update(`config.chart.items.${item.id}`, (currentItem) => {
                // items should be always references - we cannot make a copy of the object because it may lead us to troubles
                mergeDeep(currentItem, item);
                return currentItem;
            });
        }
        multi.done();
        this.data.moving = modified;
    }
    onStart() {
        this.data.initialItems = this.data.moving.map((item) => this.merge({}, item));
        this.clearCumulationsForItems();
        document.body.classList.add(this.data.bodyClassMoving);
        this.data.position = Object.assign({}, this.selection.currentPosition);
        this.data.lastMovement.time = this.data.moving[0].time.start;
        this.saveItemsRelativeVerticalPosition();
        const initial = this.data.initialItems.map((item) => this.merge({}, item));
        this.dispatchEvent('onStart', initial);
    }
    onEnd() {
        const moving = this.data.moving.map((item) => this.merge({}, item));
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
        this.data.moving = this.selection.selected[ITEM].map((item) => this.merge({}, item));
        if (this.data.debug)
            console.log('state', this.data.pointerState);
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
function Plugin$1(options = {}) {
    return function initialize(vidoInstance) {
        vidoInstance.state.update(pluginPath$1, generateEmptyPluginData(prepareOptions(options)));
        const itemMovement = new ItemMovement(vidoInstance);
        return itemMovement.destroy;
    };
}

var ItemMovement$1 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  Plugin: Plugin$1
});

/**
 * A collection of shims that provide minimal functionality of the ES6 collections.
 *
 * These implementations are not meant to be used outside of the ResizeObserver
 * modules as they cover only a limited range of use cases.
 */
/* eslint-disable require-jsdoc, valid-jsdoc */
var MapShim = (function () {
    if (typeof Map !== 'undefined') {
        return Map;
    }
    /**
     * Returns index in provided array that matches the specified key.
     *
     * @param {Array<Array>} arr
     * @param {*} key
     * @returns {number}
     */
    function getIndex(arr, key) {
        var result = -1;
        arr.some(function (entry, index) {
            if (entry[0] === key) {
                result = index;
                return true;
            }
            return false;
        });
        return result;
    }
    return /** @class */ (function () {
        function class_1() {
            this.__entries__ = [];
        }
        Object.defineProperty(class_1.prototype, "size", {
            /**
             * @returns {boolean}
             */
            get: function () {
                return this.__entries__.length;
            },
            enumerable: true,
            configurable: true
        });
        /**
         * @param {*} key
         * @returns {*}
         */
        class_1.prototype.get = function (key) {
            var index = getIndex(this.__entries__, key);
            var entry = this.__entries__[index];
            return entry && entry[1];
        };
        /**
         * @param {*} key
         * @param {*} value
         * @returns {void}
         */
        class_1.prototype.set = function (key, value) {
            var index = getIndex(this.__entries__, key);
            if (~index) {
                this.__entries__[index][1] = value;
            }
            else {
                this.__entries__.push([key, value]);
            }
        };
        /**
         * @param {*} key
         * @returns {void}
         */
        class_1.prototype.delete = function (key) {
            var entries = this.__entries__;
            var index = getIndex(entries, key);
            if (~index) {
                entries.splice(index, 1);
            }
        };
        /**
         * @param {*} key
         * @returns {void}
         */
        class_1.prototype.has = function (key) {
            return !!~getIndex(this.__entries__, key);
        };
        /**
         * @returns {void}
         */
        class_1.prototype.clear = function () {
            this.__entries__.splice(0);
        };
        /**
         * @param {Function} callback
         * @param {*} [ctx=null]
         * @returns {void}
         */
        class_1.prototype.forEach = function (callback, ctx) {
            if (ctx === void 0) { ctx = null; }
            for (var _i = 0, _a = this.__entries__; _i < _a.length; _i++) {
                var entry = _a[_i];
                callback.call(ctx, entry[1], entry[0]);
            }
        };
        return class_1;
    }());
})();

/**
 * Detects whether window and document objects are available in current environment.
 */
var isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined' && window.document === document;

// Returns global object of a current environment.
var global$1 = (function () {
    if (typeof global !== 'undefined' && global.Math === Math) {
        return global;
    }
    if (typeof self !== 'undefined' && self.Math === Math) {
        return self;
    }
    if (typeof window !== 'undefined' && window.Math === Math) {
        return window;
    }
    // eslint-disable-next-line no-new-func
    return Function('return this')();
})();

/**
 * A shim for the requestAnimationFrame which falls back to the setTimeout if
 * first one is not supported.
 *
 * @returns {number} Requests' identifier.
 */
var requestAnimationFrame$1 = (function () {
    if (typeof requestAnimationFrame === 'function') {
        // It's required to use a bounded function because IE sometimes throws
        // an "Invalid calling object" error if rAF is invoked without the global
        // object on the left hand side.
        return requestAnimationFrame.bind(global$1);
    }
    return function (callback) { return setTimeout(function () { return callback(Date.now()); }, 1000 / 60); };
})();

// Defines minimum timeout before adding a trailing call.
var trailingTimeout = 2;
/**
 * Creates a wrapper function which ensures that provided callback will be
 * invoked only once during the specified delay period.
 *
 * @param {Function} callback - Function to be invoked after the delay period.
 * @param {number} delay - Delay after which to invoke callback.
 * @returns {Function}
 */
function throttle (callback, delay) {
    var leadingCall = false, trailingCall = false, lastCallTime = 0;
    /**
     * Invokes the original callback function and schedules new invocation if
     * the "proxy" was called during current request.
     *
     * @returns {void}
     */
    function resolvePending() {
        if (leadingCall) {
            leadingCall = false;
            callback();
        }
        if (trailingCall) {
            proxy();
        }
    }
    /**
     * Callback invoked after the specified delay. It will further postpone
     * invocation of the original function delegating it to the
     * requestAnimationFrame.
     *
     * @returns {void}
     */
    function timeoutCallback() {
        requestAnimationFrame$1(resolvePending);
    }
    /**
     * Schedules invocation of the original function.
     *
     * @returns {void}
     */
    function proxy() {
        var timeStamp = Date.now();
        if (leadingCall) {
            // Reject immediately following calls.
            if (timeStamp - lastCallTime < trailingTimeout) {
                return;
            }
            // Schedule new call to be in invoked when the pending one is resolved.
            // This is important for "transitions" which never actually start
            // immediately so there is a chance that we might miss one if change
            // happens amids the pending invocation.
            trailingCall = true;
        }
        else {
            leadingCall = true;
            trailingCall = false;
            setTimeout(timeoutCallback, delay);
        }
        lastCallTime = timeStamp;
    }
    return proxy;
}

// Minimum delay before invoking the update of observers.
var REFRESH_DELAY = 20;
// A list of substrings of CSS properties used to find transition events that
// might affect dimensions of observed elements.
var transitionKeys = ['top', 'right', 'bottom', 'left', 'width', 'height', 'size', 'weight'];
// Check if MutationObserver is available.
var mutationObserverSupported = typeof MutationObserver !== 'undefined';
/**
 * Singleton controller class which handles updates of ResizeObserver instances.
 */
var ResizeObserverController = /** @class */ (function () {
    /**
     * Creates a new instance of ResizeObserverController.
     *
     * @private
     */
    function ResizeObserverController() {
        /**
         * Indicates whether DOM listeners have been added.
         *
         * @private {boolean}
         */
        this.connected_ = false;
        /**
         * Tells that controller has subscribed for Mutation Events.
         *
         * @private {boolean}
         */
        this.mutationEventsAdded_ = false;
        /**
         * Keeps reference to the instance of MutationObserver.
         *
         * @private {MutationObserver}
         */
        this.mutationsObserver_ = null;
        /**
         * A list of connected observers.
         *
         * @private {Array<ResizeObserverSPI>}
         */
        this.observers_ = [];
        this.onTransitionEnd_ = this.onTransitionEnd_.bind(this);
        this.refresh = throttle(this.refresh.bind(this), REFRESH_DELAY);
    }
    /**
     * Adds observer to observers list.
     *
     * @param {ResizeObserverSPI} observer - Observer to be added.
     * @returns {void}
     */
    ResizeObserverController.prototype.addObserver = function (observer) {
        if (!~this.observers_.indexOf(observer)) {
            this.observers_.push(observer);
        }
        // Add listeners if they haven't been added yet.
        if (!this.connected_) {
            this.connect_();
        }
    };
    /**
     * Removes observer from observers list.
     *
     * @param {ResizeObserverSPI} observer - Observer to be removed.
     * @returns {void}
     */
    ResizeObserverController.prototype.removeObserver = function (observer) {
        var observers = this.observers_;
        var index = observers.indexOf(observer);
        // Remove observer if it's present in registry.
        if (~index) {
            observers.splice(index, 1);
        }
        // Remove listeners if controller has no connected observers.
        if (!observers.length && this.connected_) {
            this.disconnect_();
        }
    };
    /**
     * Invokes the update of observers. It will continue running updates insofar
     * it detects changes.
     *
     * @returns {void}
     */
    ResizeObserverController.prototype.refresh = function () {
        var changesDetected = this.updateObservers_();
        // Continue running updates if changes have been detected as there might
        // be future ones caused by CSS transitions.
        if (changesDetected) {
            this.refresh();
        }
    };
    /**
     * Updates every observer from observers list and notifies them of queued
     * entries.
     *
     * @private
     * @returns {boolean} Returns "true" if any observer has detected changes in
     *      dimensions of it's elements.
     */
    ResizeObserverController.prototype.updateObservers_ = function () {
        // Collect observers that have active observations.
        var activeObservers = this.observers_.filter(function (observer) {
            return observer.gatherActive(), observer.hasActive();
        });
        // Deliver notifications in a separate cycle in order to avoid any
        // collisions between observers, e.g. when multiple instances of
        // ResizeObserver are tracking the same element and the callback of one
        // of them changes content dimensions of the observed target. Sometimes
        // this may result in notifications being blocked for the rest of observers.
        activeObservers.forEach(function (observer) { return observer.broadcastActive(); });
        return activeObservers.length > 0;
    };
    /**
     * Initializes DOM listeners.
     *
     * @private
     * @returns {void}
     */
    ResizeObserverController.prototype.connect_ = function () {
        // Do nothing if running in a non-browser environment or if listeners
        // have been already added.
        if (!isBrowser || this.connected_) {
            return;
        }
        // Subscription to the "Transitionend" event is used as a workaround for
        // delayed transitions. This way it's possible to capture at least the
        // final state of an element.
        document.addEventListener('transitionend', this.onTransitionEnd_);
        window.addEventListener('resize', this.refresh);
        if (mutationObserverSupported) {
            this.mutationsObserver_ = new MutationObserver(this.refresh);
            this.mutationsObserver_.observe(document, {
                attributes: true,
                childList: true,
                characterData: true,
                subtree: true
            });
        }
        else {
            document.addEventListener('DOMSubtreeModified', this.refresh);
            this.mutationEventsAdded_ = true;
        }
        this.connected_ = true;
    };
    /**
     * Removes DOM listeners.
     *
     * @private
     * @returns {void}
     */
    ResizeObserverController.prototype.disconnect_ = function () {
        // Do nothing if running in a non-browser environment or if listeners
        // have been already removed.
        if (!isBrowser || !this.connected_) {
            return;
        }
        document.removeEventListener('transitionend', this.onTransitionEnd_);
        window.removeEventListener('resize', this.refresh);
        if (this.mutationsObserver_) {
            this.mutationsObserver_.disconnect();
        }
        if (this.mutationEventsAdded_) {
            document.removeEventListener('DOMSubtreeModified', this.refresh);
        }
        this.mutationsObserver_ = null;
        this.mutationEventsAdded_ = false;
        this.connected_ = false;
    };
    /**
     * "Transitionend" event handler.
     *
     * @private
     * @param {TransitionEvent} event
     * @returns {void}
     */
    ResizeObserverController.prototype.onTransitionEnd_ = function (_a) {
        var _b = _a.propertyName, propertyName = _b === void 0 ? '' : _b;
        // Detect whether transition may affect dimensions of an element.
        var isReflowProperty = transitionKeys.some(function (key) {
            return !!~propertyName.indexOf(key);
        });
        if (isReflowProperty) {
            this.refresh();
        }
    };
    /**
     * Returns instance of the ResizeObserverController.
     *
     * @returns {ResizeObserverController}
     */
    ResizeObserverController.getInstance = function () {
        if (!this.instance_) {
            this.instance_ = new ResizeObserverController();
        }
        return this.instance_;
    };
    /**
     * Holds reference to the controller's instance.
     *
     * @private {ResizeObserverController}
     */
    ResizeObserverController.instance_ = null;
    return ResizeObserverController;
}());

/**
 * Defines non-writable/enumerable properties of the provided target object.
 *
 * @param {Object} target - Object for which to define properties.
 * @param {Object} props - Properties to be defined.
 * @returns {Object} Target object.
 */
var defineConfigurable = (function (target, props) {
    for (var _i = 0, _a = Object.keys(props); _i < _a.length; _i++) {
        var key = _a[_i];
        Object.defineProperty(target, key, {
            value: props[key],
            enumerable: false,
            writable: false,
            configurable: true
        });
    }
    return target;
});

/**
 * Returns the global object associated with provided element.
 *
 * @param {Object} target
 * @returns {Object}
 */
var getWindowOf = (function (target) {
    // Assume that the element is an instance of Node, which means that it
    // has the "ownerDocument" property from which we can retrieve a
    // corresponding global object.
    var ownerGlobal = target && target.ownerDocument && target.ownerDocument.defaultView;
    // Return the local global object if it's not possible extract one from
    // provided element.
    return ownerGlobal || global$1;
});

// Placeholder of an empty content rectangle.
var emptyRect = createRectInit(0, 0, 0, 0);
/**
 * Converts provided string to a number.
 *
 * @param {number|string} value
 * @returns {number}
 */
function toFloat(value) {
    return parseFloat(value) || 0;
}
/**
 * Extracts borders size from provided styles.
 *
 * @param {CSSStyleDeclaration} styles
 * @param {...string} positions - Borders positions (top, right, ...)
 * @returns {number}
 */
function getBordersSize(styles) {
    var positions = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        positions[_i - 1] = arguments[_i];
    }
    return positions.reduce(function (size, position) {
        var value = styles['border-' + position + '-width'];
        return size + toFloat(value);
    }, 0);
}
/**
 * Extracts paddings sizes from provided styles.
 *
 * @param {CSSStyleDeclaration} styles
 * @returns {Object} Paddings box.
 */
function getPaddings(styles) {
    var positions = ['top', 'right', 'bottom', 'left'];
    var paddings = {};
    for (var _i = 0, positions_1 = positions; _i < positions_1.length; _i++) {
        var position = positions_1[_i];
        var value = styles['padding-' + position];
        paddings[position] = toFloat(value);
    }
    return paddings;
}
/**
 * Calculates content rectangle of provided SVG element.
 *
 * @param {SVGGraphicsElement} target - Element content rectangle of which needs
 *      to be calculated.
 * @returns {DOMRectInit}
 */
function getSVGContentRect(target) {
    var bbox = target.getBBox();
    return createRectInit(0, 0, bbox.width, bbox.height);
}
/**
 * Calculates content rectangle of provided HTMLElement.
 *
 * @param {HTMLElement} target - Element for which to calculate the content rectangle.
 * @returns {DOMRectInit}
 */
function getHTMLElementContentRect(target) {
    // Client width & height properties can't be
    // used exclusively as they provide rounded values.
    var clientWidth = target.clientWidth, clientHeight = target.clientHeight;
    // By this condition we can catch all non-replaced inline, hidden and
    // detached elements. Though elements with width & height properties less
    // than 0.5 will be discarded as well.
    //
    // Without it we would need to implement separate methods for each of
    // those cases and it's not possible to perform a precise and performance
    // effective test for hidden elements. E.g. even jQuery's ':visible' filter
    // gives wrong results for elements with width & height less than 0.5.
    if (!clientWidth && !clientHeight) {
        return emptyRect;
    }
    var styles = getWindowOf(target).getComputedStyle(target);
    var paddings = getPaddings(styles);
    var horizPad = paddings.left + paddings.right;
    var vertPad = paddings.top + paddings.bottom;
    // Computed styles of width & height are being used because they are the
    // only dimensions available to JS that contain non-rounded values. It could
    // be possible to utilize the getBoundingClientRect if only it's data wasn't
    // affected by CSS transformations let alone paddings, borders and scroll bars.
    var width = toFloat(styles.width), height = toFloat(styles.height);
    // Width & height include paddings and borders when the 'border-box' box
    // model is applied (except for IE).
    if (styles.boxSizing === 'border-box') {
        // Following conditions are required to handle Internet Explorer which
        // doesn't include paddings and borders to computed CSS dimensions.
        //
        // We can say that if CSS dimensions + paddings are equal to the "client"
        // properties then it's either IE, and thus we don't need to subtract
        // anything, or an element merely doesn't have paddings/borders styles.
        if (Math.round(width + horizPad) !== clientWidth) {
            width -= getBordersSize(styles, 'left', 'right') + horizPad;
        }
        if (Math.round(height + vertPad) !== clientHeight) {
            height -= getBordersSize(styles, 'top', 'bottom') + vertPad;
        }
    }
    // Following steps can't be applied to the document's root element as its
    // client[Width/Height] properties represent viewport area of the window.
    // Besides, it's as well not necessary as the <html> itself neither has
    // rendered scroll bars nor it can be clipped.
    if (!isDocumentElement(target)) {
        // In some browsers (only in Firefox, actually) CSS width & height
        // include scroll bars size which can be removed at this step as scroll
        // bars are the only difference between rounded dimensions + paddings
        // and "client" properties, though that is not always true in Chrome.
        var vertScrollbar = Math.round(width + horizPad) - clientWidth;
        var horizScrollbar = Math.round(height + vertPad) - clientHeight;
        // Chrome has a rather weird rounding of "client" properties.
        // E.g. for an element with content width of 314.2px it sometimes gives
        // the client width of 315px and for the width of 314.7px it may give
        // 314px. And it doesn't happen all the time. So just ignore this delta
        // as a non-relevant.
        if (Math.abs(vertScrollbar) !== 1) {
            width -= vertScrollbar;
        }
        if (Math.abs(horizScrollbar) !== 1) {
            height -= horizScrollbar;
        }
    }
    return createRectInit(paddings.left, paddings.top, width, height);
}
/**
 * Checks whether provided element is an instance of the SVGGraphicsElement.
 *
 * @param {Element} target - Element to be checked.
 * @returns {boolean}
 */
var isSVGGraphicsElement = (function () {
    // Some browsers, namely IE and Edge, don't have the SVGGraphicsElement
    // interface.
    if (typeof SVGGraphicsElement !== 'undefined') {
        return function (target) { return target instanceof getWindowOf(target).SVGGraphicsElement; };
    }
    // If it's so, then check that element is at least an instance of the
    // SVGElement and that it has the "getBBox" method.
    // eslint-disable-next-line no-extra-parens
    return function (target) { return (target instanceof getWindowOf(target).SVGElement &&
        typeof target.getBBox === 'function'); };
})();
/**
 * Checks whether provided element is a document element (<html>).
 *
 * @param {Element} target - Element to be checked.
 * @returns {boolean}
 */
function isDocumentElement(target) {
    return target === getWindowOf(target).document.documentElement;
}
/**
 * Calculates an appropriate content rectangle for provided html or svg element.
 *
 * @param {Element} target - Element content rectangle of which needs to be calculated.
 * @returns {DOMRectInit}
 */
function getContentRect(target) {
    if (!isBrowser) {
        return emptyRect;
    }
    if (isSVGGraphicsElement(target)) {
        return getSVGContentRect(target);
    }
    return getHTMLElementContentRect(target);
}
/**
 * Creates rectangle with an interface of the DOMRectReadOnly.
 * Spec: https://drafts.fxtf.org/geometry/#domrectreadonly
 *
 * @param {DOMRectInit} rectInit - Object with rectangle's x/y coordinates and dimensions.
 * @returns {DOMRectReadOnly}
 */
function createReadOnlyRect(_a) {
    var x = _a.x, y = _a.y, width = _a.width, height = _a.height;
    // If DOMRectReadOnly is available use it as a prototype for the rectangle.
    var Constr = typeof DOMRectReadOnly !== 'undefined' ? DOMRectReadOnly : Object;
    var rect = Object.create(Constr.prototype);
    // Rectangle's properties are not writable and non-enumerable.
    defineConfigurable(rect, {
        x: x, y: y, width: width, height: height,
        top: y,
        right: x + width,
        bottom: height + y,
        left: x
    });
    return rect;
}
/**
 * Creates DOMRectInit object based on the provided dimensions and the x/y coordinates.
 * Spec: https://drafts.fxtf.org/geometry/#dictdef-domrectinit
 *
 * @param {number} x - X coordinate.
 * @param {number} y - Y coordinate.
 * @param {number} width - Rectangle's width.
 * @param {number} height - Rectangle's height.
 * @returns {DOMRectInit}
 */
function createRectInit(x, y, width, height) {
    return { x: x, y: y, width: width, height: height };
}

/**
 * Class that is responsible for computations of the content rectangle of
 * provided DOM element and for keeping track of it's changes.
 */
var ResizeObservation = /** @class */ (function () {
    /**
     * Creates an instance of ResizeObservation.
     *
     * @param {Element} target - Element to be observed.
     */
    function ResizeObservation(target) {
        /**
         * Broadcasted width of content rectangle.
         *
         * @type {number}
         */
        this.broadcastWidth = 0;
        /**
         * Broadcasted height of content rectangle.
         *
         * @type {number}
         */
        this.broadcastHeight = 0;
        /**
         * Reference to the last observed content rectangle.
         *
         * @private {DOMRectInit}
         */
        this.contentRect_ = createRectInit(0, 0, 0, 0);
        this.target = target;
    }
    /**
     * Updates content rectangle and tells whether it's width or height properties
     * have changed since the last broadcast.
     *
     * @returns {boolean}
     */
    ResizeObservation.prototype.isActive = function () {
        var rect = getContentRect(this.target);
        this.contentRect_ = rect;
        return (rect.width !== this.broadcastWidth ||
            rect.height !== this.broadcastHeight);
    };
    /**
     * Updates 'broadcastWidth' and 'broadcastHeight' properties with a data
     * from the corresponding properties of the last observed content rectangle.
     *
     * @returns {DOMRectInit} Last observed content rectangle.
     */
    ResizeObservation.prototype.broadcastRect = function () {
        var rect = this.contentRect_;
        this.broadcastWidth = rect.width;
        this.broadcastHeight = rect.height;
        return rect;
    };
    return ResizeObservation;
}());

var ResizeObserverEntry = /** @class */ (function () {
    /**
     * Creates an instance of ResizeObserverEntry.
     *
     * @param {Element} target - Element that is being observed.
     * @param {DOMRectInit} rectInit - Data of the element's content rectangle.
     */
    function ResizeObserverEntry(target, rectInit) {
        var contentRect = createReadOnlyRect(rectInit);
        // According to the specification following properties are not writable
        // and are also not enumerable in the native implementation.
        //
        // Property accessors are not being used as they'd require to define a
        // private WeakMap storage which may cause memory leaks in browsers that
        // don't support this type of collections.
        defineConfigurable(this, { target: target, contentRect: contentRect });
    }
    return ResizeObserverEntry;
}());

var ResizeObserverSPI = /** @class */ (function () {
    /**
     * Creates a new instance of ResizeObserver.
     *
     * @param {ResizeObserverCallback} callback - Callback function that is invoked
     *      when one of the observed elements changes it's content dimensions.
     * @param {ResizeObserverController} controller - Controller instance which
     *      is responsible for the updates of observer.
     * @param {ResizeObserver} callbackCtx - Reference to the public
     *      ResizeObserver instance which will be passed to callback function.
     */
    function ResizeObserverSPI(callback, controller, callbackCtx) {
        /**
         * Collection of resize observations that have detected changes in dimensions
         * of elements.
         *
         * @private {Array<ResizeObservation>}
         */
        this.activeObservations_ = [];
        /**
         * Registry of the ResizeObservation instances.
         *
         * @private {Map<Element, ResizeObservation>}
         */
        this.observations_ = new MapShim();
        if (typeof callback !== 'function') {
            throw new TypeError('The callback provided as parameter 1 is not a function.');
        }
        this.callback_ = callback;
        this.controller_ = controller;
        this.callbackCtx_ = callbackCtx;
    }
    /**
     * Starts observing provided element.
     *
     * @param {Element} target - Element to be observed.
     * @returns {void}
     */
    ResizeObserverSPI.prototype.observe = function (target) {
        if (!arguments.length) {
            throw new TypeError('1 argument required, but only 0 present.');
        }
        // Do nothing if current environment doesn't have the Element interface.
        if (typeof Element === 'undefined' || !(Element instanceof Object)) {
            return;
        }
        if (!(target instanceof getWindowOf(target).Element)) {
            throw new TypeError('parameter 1 is not of type "Element".');
        }
        var observations = this.observations_;
        // Do nothing if element is already being observed.
        if (observations.has(target)) {
            return;
        }
        observations.set(target, new ResizeObservation(target));
        this.controller_.addObserver(this);
        // Force the update of observations.
        this.controller_.refresh();
    };
    /**
     * Stops observing provided element.
     *
     * @param {Element} target - Element to stop observing.
     * @returns {void}
     */
    ResizeObserverSPI.prototype.unobserve = function (target) {
        if (!arguments.length) {
            throw new TypeError('1 argument required, but only 0 present.');
        }
        // Do nothing if current environment doesn't have the Element interface.
        if (typeof Element === 'undefined' || !(Element instanceof Object)) {
            return;
        }
        if (!(target instanceof getWindowOf(target).Element)) {
            throw new TypeError('parameter 1 is not of type "Element".');
        }
        var observations = this.observations_;
        // Do nothing if element is not being observed.
        if (!observations.has(target)) {
            return;
        }
        observations.delete(target);
        if (!observations.size) {
            this.controller_.removeObserver(this);
        }
    };
    /**
     * Stops observing all elements.
     *
     * @returns {void}
     */
    ResizeObserverSPI.prototype.disconnect = function () {
        this.clearActive();
        this.observations_.clear();
        this.controller_.removeObserver(this);
    };
    /**
     * Collects observation instances the associated element of which has changed
     * it's content rectangle.
     *
     * @returns {void}
     */
    ResizeObserverSPI.prototype.gatherActive = function () {
        var _this = this;
        this.clearActive();
        this.observations_.forEach(function (observation) {
            if (observation.isActive()) {
                _this.activeObservations_.push(observation);
            }
        });
    };
    /**
     * Invokes initial callback function with a list of ResizeObserverEntry
     * instances collected from active resize observations.
     *
     * @returns {void}
     */
    ResizeObserverSPI.prototype.broadcastActive = function () {
        // Do nothing if observer doesn't have active observations.
        if (!this.hasActive()) {
            return;
        }
        var ctx = this.callbackCtx_;
        // Create ResizeObserverEntry instance for every active observation.
        var entries = this.activeObservations_.map(function (observation) {
            return new ResizeObserverEntry(observation.target, observation.broadcastRect());
        });
        this.callback_.call(ctx, entries, ctx);
        this.clearActive();
    };
    /**
     * Clears the collection of active observations.
     *
     * @returns {void}
     */
    ResizeObserverSPI.prototype.clearActive = function () {
        this.activeObservations_.splice(0);
    };
    /**
     * Tells whether observer has active observations.
     *
     * @returns {boolean}
     */
    ResizeObserverSPI.prototype.hasActive = function () {
        return this.activeObservations_.length > 0;
    };
    return ResizeObserverSPI;
}());

// Registry of internal observers. If WeakMap is not available use current shim
// for the Map collection as it has all required methods and because WeakMap
// can't be fully polyfilled anyway.
var observers = typeof WeakMap !== 'undefined' ? new WeakMap() : new MapShim();
/**
 * ResizeObserver API. Encapsulates the ResizeObserver SPI implementation
 * exposing only those methods and properties that are defined in the spec.
 */
var ResizeObserver = /** @class */ (function () {
    /**
     * Creates a new instance of ResizeObserver.
     *
     * @param {ResizeObserverCallback} callback - Callback that is invoked when
     *      dimensions of the observed elements change.
     */
    function ResizeObserver(callback) {
        if (!(this instanceof ResizeObserver)) {
            throw new TypeError('Cannot call a class as a function.');
        }
        if (!arguments.length) {
            throw new TypeError('1 argument required, but only 0 present.');
        }
        var controller = ResizeObserverController.getInstance();
        var observer = new ResizeObserverSPI(callback, controller, this);
        observers.set(this, observer);
    }
    return ResizeObserver;
}());
// Expose public methods of ResizeObserver.
[
    'observe',
    'unobserve',
    'disconnect'
].forEach(function (method) {
    ResizeObserver.prototype[method] = function () {
        var _a;
        return (_a = observers.get(this))[method].apply(_a, arguments);
    };
});

var index = (function () {
    // Export existing implementation if available.
    if (typeof global$1.ResizeObserver !== 'undefined') {
        return global$1.ResizeObserver;
    }
    return ResizeObserver;
})();

class Action {
    constructor() {
        this.isAction = true;
    }
}
Action.prototype.isAction = true;

var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

function createCommonjsModule(fn, module) {
	return module = { exports: {} }, fn(module, module.exports), module.exports;
}

var dayjs_min = createCommonjsModule(function (module, exports) {
!function(t,n){module.exports=n();}(commonjsGlobal,function(){var t="millisecond",n="second",e="minute",r="hour",i="day",s="week",u="month",o="quarter",a="year",h=/^(\d{4})-?(\d{1,2})-?(\d{0,2})[^0-9]*(\d{1,2})?:?(\d{1,2})?:?(\d{1,2})?.?(\d{1,3})?$/,f=/\[([^\]]+)]|Y{2,4}|M{1,4}|D{1,2}|d{1,4}|H{1,2}|h{1,2}|a|A|m{1,2}|s{1,2}|Z{1,2}|SSS/g,c=function(t,n,e){var r=String(t);return !r||r.length>=n?t:""+Array(n+1-r.length).join(e)+t},d={s:c,z:function(t){var n=-t.utcOffset(),e=Math.abs(n),r=Math.floor(e/60),i=e%60;return (n<=0?"+":"-")+c(r,2,"0")+":"+c(i,2,"0")},m:function(t,n){var e=12*(n.year()-t.year())+(n.month()-t.month()),r=t.clone().add(e,u),i=n-r<0,s=t.clone().add(e+(i?-1:1),u);return Number(-(e+(n-r)/(i?r-s:s-r))||0)},a:function(t){return t<0?Math.ceil(t)||0:Math.floor(t)},p:function(h){return {M:u,y:a,w:s,d:i,D:"date",h:r,m:e,s:n,ms:t,Q:o}[h]||String(h||"").toLowerCase().replace(/s$/,"")},u:function(t){return void 0===t}},$={name:"en",weekdays:"Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday".split("_"),months:"January_February_March_April_May_June_July_August_September_October_November_December".split("_")},l="en",m={};m[l]=$;var y=function(t){return t instanceof v},M=function(t,n,e){var r;if(!t)return l;if("string"==typeof t)m[t]&&(r=t),n&&(m[t]=n,r=t);else {var i=t.name;m[i]=t,r=i;}return !e&&r&&(l=r),r||!e&&l},g=function(t,n,e){if(y(t))return t.clone();var r=n?"string"==typeof n?{format:n,pl:e}:n:{};return r.date=t,new v(r)},D=d;D.l=M,D.i=y,D.w=function(t,n){return g(t,{locale:n.$L,utc:n.$u,$offset:n.$offset})};var v=function(){function c(t){this.$L=this.$L||M(t.locale,null,!0),this.parse(t);}var d=c.prototype;return d.parse=function(t){this.$d=function(t){var n=t.date,e=t.utc;if(null===n)return new Date(NaN);if(D.u(n))return new Date;if(n instanceof Date)return new Date(n);if("string"==typeof n&&!/Z$/i.test(n)){var r=n.match(h);if(r)return e?new Date(Date.UTC(r[1],r[2]-1,r[3]||1,r[4]||0,r[5]||0,r[6]||0,r[7]||0)):new Date(r[1],r[2]-1,r[3]||1,r[4]||0,r[5]||0,r[6]||0,r[7]||0)}return new Date(n)}(t),this.init();},d.init=function(){var t=this.$d;this.$y=t.getFullYear(),this.$M=t.getMonth(),this.$D=t.getDate(),this.$W=t.getDay(),this.$H=t.getHours(),this.$m=t.getMinutes(),this.$s=t.getSeconds(),this.$ms=t.getMilliseconds();},d.$utils=function(){return D},d.isValid=function(){return !("Invalid Date"===this.$d.toString())},d.isSame=function(t,n){var e=g(t);return this.startOf(n)<=e&&e<=this.endOf(n)},d.isAfter=function(t,n){return g(t)<this.startOf(n)},d.isBefore=function(t,n){return this.endOf(n)<g(t)},d.$g=function(t,n,e){return D.u(t)?this[n]:this.set(e,t)},d.year=function(t){return this.$g(t,"$y",a)},d.month=function(t){return this.$g(t,"$M",u)},d.day=function(t){return this.$g(t,"$W",i)},d.date=function(t){return this.$g(t,"$D","date")},d.hour=function(t){return this.$g(t,"$H",r)},d.minute=function(t){return this.$g(t,"$m",e)},d.second=function(t){return this.$g(t,"$s",n)},d.millisecond=function(n){return this.$g(n,"$ms",t)},d.unix=function(){return Math.floor(this.valueOf()/1e3)},d.valueOf=function(){return this.$d.getTime()},d.startOf=function(t,o){var h=this,f=!!D.u(o)||o,c=D.p(t),d=function(t,n){var e=D.w(h.$u?Date.UTC(h.$y,n,t):new Date(h.$y,n,t),h);return f?e:e.endOf(i)},$=function(t,n){return D.w(h.toDate()[t].apply(h.toDate(),(f?[0,0,0,0]:[23,59,59,999]).slice(n)),h)},l=this.$W,m=this.$M,y=this.$D,M="set"+(this.$u?"UTC":"");switch(c){case a:return f?d(1,0):d(31,11);case u:return f?d(1,m):d(0,m+1);case s:var g=this.$locale().weekStart||0,v=(l<g?l+7:l)-g;return d(f?y-v:y+(6-v),m);case i:case"date":return $(M+"Hours",0);case r:return $(M+"Minutes",1);case e:return $(M+"Seconds",2);case n:return $(M+"Milliseconds",3);default:return this.clone()}},d.endOf=function(t){return this.startOf(t,!1)},d.$set=function(s,o){var h,f=D.p(s),c="set"+(this.$u?"UTC":""),d=(h={},h[i]=c+"Date",h.date=c+"Date",h[u]=c+"Month",h[a]=c+"FullYear",h[r]=c+"Hours",h[e]=c+"Minutes",h[n]=c+"Seconds",h[t]=c+"Milliseconds",h)[f],$=f===i?this.$D+(o-this.$W):o;if(f===u||f===a){var l=this.clone().set("date",1);l.$d[d]($),l.init(),this.$d=l.set("date",Math.min(this.$D,l.daysInMonth())).toDate();}else d&&this.$d[d]($);return this.init(),this},d.set=function(t,n){return this.clone().$set(t,n)},d.get=function(t){return this[D.p(t)]()},d.add=function(t,o){var h,f=this;t=Number(t);var c=D.p(o),d=function(n){var e=g(f);return D.w(e.date(e.date()+Math.round(n*t)),f)};if(c===u)return this.set(u,this.$M+t);if(c===a)return this.set(a,this.$y+t);if(c===i)return d(1);if(c===s)return d(7);var $=(h={},h[e]=6e4,h[r]=36e5,h[n]=1e3,h)[c]||1,l=this.$d.getTime()+t*$;return D.w(l,this)},d.subtract=function(t,n){return this.add(-1*t,n)},d.format=function(t){var n=this;if(!this.isValid())return "Invalid Date";var e=t||"YYYY-MM-DDTHH:mm:ssZ",r=D.z(this),i=this.$locale(),s=this.$H,u=this.$m,o=this.$M,a=i.weekdays,h=i.months,c=function(t,r,i,s){return t&&(t[r]||t(n,e))||i[r].substr(0,s)},d=function(t){return D.s(s%12||12,t,"0")},$=i.meridiem||function(t,n,e){var r=t<12?"AM":"PM";return e?r.toLowerCase():r},l={YY:String(this.$y).slice(-2),YYYY:this.$y,M:o+1,MM:D.s(o+1,2,"0"),MMM:c(i.monthsShort,o,h,3),MMMM:h[o]||h(this,e),D:this.$D,DD:D.s(this.$D,2,"0"),d:String(this.$W),dd:c(i.weekdaysMin,this.$W,a,2),ddd:c(i.weekdaysShort,this.$W,a,3),dddd:a[this.$W],H:String(s),HH:D.s(s,2,"0"),h:d(1),hh:d(2),a:$(s,u,!0),A:$(s,u,!1),m:String(u),mm:D.s(u,2,"0"),s:String(this.$s),ss:D.s(this.$s,2,"0"),SSS:D.s(this.$ms,3,"0"),Z:r};return e.replace(f,function(t,n){return n||l[t]||r.replace(":","")})},d.utcOffset=function(){return 15*-Math.round(this.$d.getTimezoneOffset()/15)},d.diff=function(t,h,f){var c,d=D.p(h),$=g(t),l=6e4*($.utcOffset()-this.utcOffset()),m=this-$,y=D.m(this,$);return y=(c={},c[a]=y/12,c[u]=y,c[o]=y/3,c[s]=(m-l)/6048e5,c[i]=(m-l)/864e5,c[r]=m/36e5,c[e]=m/6e4,c[n]=m/1e3,c)[d]||m,f?y:D.a(y)},d.daysInMonth=function(){return this.endOf(u).$D},d.$locale=function(){return m[this.$L]},d.locale=function(t,n){if(!t)return this.$L;var e=this.clone(),r=M(t,n,!0);return r&&(e.$L=r),e},d.clone=function(){return D.w(this.$d,this)},d.toDate=function(){return new Date(this.valueOf())},d.toJSON=function(){return this.isValid()?this.toISOString():null},d.toISOString=function(){return this.$d.toISOString()},d.toString=function(){return this.$d.toUTCString()},c}();return g.prototype=v.prototype,g.extend=function(t,n){return t(n,v,g),g},g.locale=M,g.isDayjs=y,g.unix=function(t){return g(1e3*t)},g.en=m[l],g.Ls=m,g});
});

var utc = createCommonjsModule(function (module, exports) {
!function(t,i){module.exports=i();}(commonjsGlobal,function(){return function(t,i,e){var s=(new Date).getTimezoneOffset(),n=i.prototype;e.utc=function(t,e){return new i({date:t,utc:!0,format:e})},n.utc=function(){return e(this.toDate(),{locale:this.$L,utc:!0})},n.local=function(){return e(this.toDate(),{locale:this.$L,utc:!1})};var u=n.parse;n.parse=function(t){t.utc&&(this.$u=!0),this.$utils().u(t.$offset)||(this.$offset=t.$offset),u.call(this,t);};var o=n.init;n.init=function(){if(this.$u){var t=this.$d;this.$y=t.getUTCFullYear(),this.$M=t.getUTCMonth(),this.$D=t.getUTCDate(),this.$W=t.getUTCDay(),this.$H=t.getUTCHours(),this.$m=t.getUTCMinutes(),this.$s=t.getUTCSeconds(),this.$ms=t.getUTCMilliseconds();}else o.call(this);};var f=n.utcOffset;n.utcOffset=function(t){var i=this.$utils().u;if(i(t))return this.$u?0:i(this.$offset)?f.call(this):this.$offset;var e,n=Math.abs(t)<=16?60*t:t;return 0!==t?(e=this.local().add(n+s,"minute")).$offset=n:e=this.utc(),e};var r=n.format;n.format=function(t){var i=t||(this.$u?"YYYY-MM-DDTHH:mm:ss[Z]":"");return r.call(this,i)},n.valueOf=function(){var t=this.$utils().u(this.$offset)?0:this.$offset+s;return this.$d.valueOf()-6e4*t},n.isUTC=function(){return !!this.$u},n.toISOString=function(){return this.toDate().toISOString()},n.toString=function(){return this.toDate().toUTCString()};}});
});

let cachedTextEncoder = new TextEncoder("utf-8");

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
const e=e=>(...t)=>{const n=e(...t);return n.isDirective=!0,n};class t{constructor(){this.isDirective=!0,this.isClass=!0;}body(e){}}const n=e=>null!=e&&"boolean"==typeof e.isDirective,s="undefined"!=typeof window&&(null!=window.customElements&&void 0!==window.customElements.polyfillWrapFlushCallback),o=(e,t,n=null,s=null)=>{for(;t!==n;){const n=t.nextSibling;e.insertBefore(t,s),t=n;}},i=(e,t,n=null)=>{for(;t!==n;){const n=t.nextSibling;e.removeChild(t),t=n;}},r={},a={},l=`{{lit-${String(Math.random()).slice(2)}}}`,c=`\x3c!--${l}--\x3e`,h=new RegExp(`${l}|${c}`);
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
 */class d{constructor(e,t){this.parts=[],this.element=t;const n=[],s=[],o=document.createTreeWalker(t.content,133,null,!1);let i=0,r=-1,a=0;const{strings:c,values:{length:d}}=e;for(;a<d;){const e=o.nextNode();if(null!==e){if(r++,1===e.nodeType){if(e.hasAttributes()){const t=e.attributes,{length:n}=t;let s=0;for(let e=0;e<n;e++)p(t[e].name,"$lit$")&&s++;for(;s-- >0;){const t=c[a],n=g.exec(t)[2],s=n.toLowerCase()+"$lit$",o=e.getAttribute(s);e.removeAttribute(s);const i=o.split(h);this.parts.push({type:"attribute",index:r,name:n,strings:i,sanitizer:void 0}),a+=i.length-1;}}"TEMPLATE"===e.tagName&&(s.push(e),o.currentNode=e.content);}else if(3===e.nodeType){const t=e.data;if(t.indexOf(l)>=0){const s=e.parentNode,o=t.split(h),i=o.length-1;for(let t=0;t<i;t++){let n,i=o[t];if(""===i)n=v();else {const e=g.exec(i);null!==e&&p(e[2],"$lit$")&&(i=i.slice(0,e.index)+e[1]+e[2].slice(0,-"$lit$".length)+e[3]),n=document.createTextNode(i);}s.insertBefore(n,e),this.parts.push({type:"node",index:++r});}""===o[i]?(s.insertBefore(v(),e),n.push(e)):e.data=o[i],a+=i;}}else if(8===e.nodeType)if(e.data===l){const t=e.parentNode;null!==e.previousSibling&&r!==i||(r++,t.insertBefore(v(),e)),i=r,this.parts.push({type:"node",index:r}),null===e.nextSibling?e.data="":(n.push(e),r--),a++;}else {let t=-1;for(;-1!==(t=e.data.indexOf(l,t+1));)this.parts.push({type:"node",index:-1}),a++;}}else o.currentNode=s.pop();}for(const e of n)e.parentNode.removeChild(e);}}const p=(e,t)=>{const n=e.length-t.length;return n>=0&&e.slice(n)===t},u=e=>-1!==e.index,m=document.createComment(""),v=()=>m.cloneNode(),g=/([ \x09\x0a\x0c\x0d])([^\0-\x1F\x7F-\x9F "'>=/]+)([ \x09\x0a\x0c\x0d]*=[ \x09\x0a\x0c\x0d]*(?:[^ \x09\x0a\x0c\x0d"'`<>=]*|"[^"]*|'[^']*))$/;
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
class f{constructor(e,t,n){this.__parts=[],this.template=e,this.processor=t,this.options=n;}update(e){let t=0;for(const n of this.__parts)void 0!==n&&n.setValue(e[t]),t++;for(const e of this.__parts)void 0!==e&&e.commit();}_clone(){const e=s?this.template.element.content.cloneNode(!0):document.importNode(this.template.element.content,!0),t=[],n=this.template.parts,o=document.createTreeWalker(e,133,null,!1);let i,r=0,a=0,l=o.nextNode();for(;r<n.length;)if(i=n[r],u(i)){for(;a<i.index;)a++,"TEMPLATE"===l.nodeName&&(t.push(l),o.currentNode=l.content),null===(l=o.nextNode())&&(o.currentNode=t.pop(),l=o.nextNode());if("node"===i.type){const e=this.processor.handleTextExpression(this.options,i);e.insertAfterNode(l.previousSibling),this.__parts.push(e);}else this.__parts.push(...this.processor.handleAttributeExpressions(l,i.name,i.strings,this.options,i));r++;}else this.__parts.push(void 0),r++;return s&&(document.adoptNode(e),customElements.upgrade(e)),e}}
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
 */let y;const x=` ${l} `,b=document.createElement("template");class _{constructor(e,t,n,s){this.strings=e,this.values=t,this.type=n,this.processor=s;}getHTML(){const e=this.strings.length-1;let t="",n=!1;for(let s=0;s<e;s++){const e=this.strings[s],o=e.lastIndexOf("\x3c!--");n=(o>-1||n)&&-1===e.indexOf("--\x3e",o+1);const i=g.exec(e);t+=null===i?e+(n?x:c):e.substr(0,i.index)+i[1]+i[2]+"$lit$"+i[3]+l;}return t+=this.strings[e],t}getTemplateElement(){const e=b.cloneNode();return e.innerHTML=function(e){const t=window,n=t.trustedTypes||t.TrustedTypes;return n&&!y&&(y=n.createPolicy("lit-html",{createHTML:e=>e})),y?y.createHTML(e):e}(this.getHTML()),e}}class w extends _{getHTML(){return `<svg>${super.getHTML()}</svg>`}getTemplateElement(){const e=super.getTemplateElement(),t=e.content,n=t.firstChild;return t.removeChild(n),o(t,n.firstChild),e}}
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
 */const N=e=>null===e||!("object"==typeof e||"function"==typeof e),P=e=>Array.isArray(e)||!(!e||!e[Symbol.iterator]),E=e=>e,A=(e,t,n)=>E;let M=A;const S=document.createTextNode("");class T{constructor(e,t,n,s,o="attribute"){this.dirty=!0,this.element=e,this.name=t,this.strings=n,this.parts=[];let i=s&&s.sanitizer;void 0===i&&(i=M(e,t,o),void 0!==s&&(s.sanitizer=i)),this.sanitizer=i;for(let e=0;e<n.length-1;e++)this.parts[e]=this._createPart();}_createPart(){return new Y(this)}_getValue(){const e=this.strings,t=this.parts,n=e.length-1;if(1===n&&""===e[0]&&""===e[1]&&void 0!==t[0]){const e=t[0].value;if(!P(e))return e}let s="";for(let o=0;o<n;o++){s+=e[o];const n=t[o];if(void 0!==n){const e=n.value;if(N(e)||!P(e))s+="string"==typeof e?e:String(e);else for(const t of e)s+="string"==typeof t?t:String(t);}}return s+=e[n],s}commit(){if(this.dirty){this.dirty=!1;let e=this._getValue();e=this.sanitizer(e),"symbol"==typeof e&&(e=String(e)),this.element.setAttribute(this.name,e);}}}class Y{constructor(e){this.value=void 0,this.committer=e;}setValue(e){e===r||N(e)&&e===this.value||(this.value=e,n(e)||(this.committer.dirty=!0));}commit(){for(;n(this.value);){const e=this.value;this.value=r,e.isClass?e.body(this):e(this);}this.value!==r&&this.committer.commit();}}class X{constructor(e,t){this.value=void 0,this.__pendingValue=void 0,this.textSanitizer=void 0,this.options=e,this.templatePart=t;}appendInto(e){this.startNode=e.appendChild(v()),this.endNode=e.appendChild(v());}insertAfterNode(e){this.startNode=e,this.endNode=e.nextSibling;}appendIntoPart(e){e.__insert(this.startNode=v()),e.__insert(this.endNode=v());}insertAfterPart(e){e.__insert(this.startNode=v()),this.endNode=e.endNode,e.endNode=this.startNode;}setValue(e){this.__pendingValue=e;}commit(){for(;n(this.__pendingValue);){const e=this.__pendingValue;this.__pendingValue=r,e.isClass?e.body(this):e(this);}const e=this.__pendingValue;e!==r&&(N(e)?e!==this.value&&this.__commitText(e):e instanceof _?this.__commitTemplateResult(e):e instanceof Node?this.__commitNode(e):P(e)?this.__commitIterable(e):e===a?(this.value=a,this.clear()):this.__commitText(e));}__insert(e){this.endNode.parentNode.insertBefore(e,this.endNode);}__commitNode(e){this.value!==e&&(this.clear(),this.__insert(e),this.value=e);}__commitText(e){const t=this.startNode.nextSibling;if(e=null==e?"":e,t===this.endNode.previousSibling&&3===t.nodeType){void 0===this.textSanitizer&&(this.textSanitizer=M(t,"data","property"));const n=this.textSanitizer(e);t.data="string"==typeof n?n:String(n);}else {const t=S.cloneNode();this.__commitNode(t),void 0===this.textSanitizer&&(this.textSanitizer=M(t,"data","property"));const n=this.textSanitizer(e);t.data="string"==typeof n?n:String(n);}this.value=e;}__commitTemplateResult(e){const t=this.options.templateFactory(e);if(this.value instanceof f&&this.value.template===t)this.value.update(e.values);else {const n=this.endNode.parentNode;if(M!==A&&"STYLE"===n.nodeName||"SCRIPT"===n.nodeName)return void this.__commitText("/* lit-html will not write TemplateResults to scripts and styles */");const s=new f(t,e.processor,this.options),o=s._clone();s.update(e.values),this.__commitNode(o),this.value=s;}}__commitIterable(e){Array.isArray(this.value)||(this.value=[],this.clear());const t=this.value;let n,s=0;for(const o of e)n=t[s],void 0===n&&(n=new X(this.options,this.templatePart),t.push(n),0===s?n.appendIntoPart(this):n.insertAfterPart(t[s-1])),n.setValue(o),n.commit(),s++;s<t.length&&(t.length=s,this.clear(n&&n.endNode));}clear(e=this.startNode){i(this.startNode.parentNode,e.nextSibling,this.endNode);}}class I{constructor(e,t,n){if(this.value=void 0,this.__pendingValue=void 0,2!==n.length||""!==n[0]||""!==n[1])throw new Error("Boolean attributes can only contain a single expression");this.element=e,this.name=t,this.strings=n;}setValue(e){this.__pendingValue=e;}commit(){for(;n(this.__pendingValue);){const e=this.__pendingValue;this.__pendingValue=r,e.isClass?e.body(this):e(this);}if(this.__pendingValue===r)return;const e=!!this.__pendingValue;this.value!==e&&(e?this.element.setAttribute(this.name,""):this.element.removeAttribute(this.name),this.value=e),this.__pendingValue=r;}}class C extends T{constructor(e,t,n,s){super(e,t,n,s,"property"),this.single=2===n.length&&""===n[0]&&""===n[1];}_createPart(){return new V(this)}_getValue(){return this.single?this.parts[0].value:super._getValue()}commit(){if(this.dirty){this.dirty=!1;let e=this._getValue();e=this.sanitizer(e),this.element[this.name]=e;}}}class V extends Y{}let L=!1;(()=>{try{const e={get capture(){return L=!0,!1}};window.addEventListener("test",e,e),window.removeEventListener("test",e,e);}catch(e){}})();class k{constructor(e,t,n){this.value=void 0,this.__pendingValue=void 0,this.element=e,this.eventName=t,this.eventContext=n,this.__boundHandleEvent=e=>this.handleEvent(e);}setValue(e){this.__pendingValue=e;}commit(){for(;n(this.__pendingValue);){const e=this.__pendingValue;this.__pendingValue=r,e.isClass?e.body(this):e(this);}if(this.__pendingValue===r)return;const e=this.__pendingValue,t=this.value,s=null==e||null!=t&&(e.capture!==t.capture||e.once!==t.once||e.passive!==t.passive),o=null!=e&&(null==t||s);s&&this.element.removeEventListener(this.eventName,this.__boundHandleEvent,this.__options),o&&(this.__options=D(e),this.element.addEventListener(this.eventName,this.__boundHandleEvent,this.__options)),this.value=e,this.__pendingValue=r;}handleEvent(e){"function"==typeof this.value?this.value.call(this.eventContext||this.element,e):this.value.handleEvent(e);}}const D=e=>e&&(L?{capture:e.capture,passive:e.passive,once:e.once}:e.capture)
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
 */;class ${handleAttributeExpressions(e,t,n,s,o){const i=t[0];if("."===i){return new C(e,t.slice(1),n,o).parts}return "@"===i?[new k(e,t.slice(1),s.eventContext)]:"?"===i?[new I(e,t.slice(1),n)]:new T(e,t,n,o).parts}handleTextExpression(e,t){return new X(e,t)}}const z=new $;
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
 */function R(e){let t=F.get(e.type);void 0===t&&(t={stringsArray:new WeakMap,keyString:new Map},F.set(e.type,t));let n=t.stringsArray.get(e.strings);if(void 0!==n)return n;const s=e.strings.join(l);return n=t.keyString.get(s),void 0===n&&(n=new d(e,e.getTemplateElement()),t.keyString.set(s,n)),t.stringsArray.set(e.strings,n),n}const F=new Map,B=new WeakMap,W=(e,t,n)=>{let s=B.get(t);void 0===s&&(i(t,t.firstChild),B.set(t,s=new X(Object.assign({templateFactory:R},n),void 0)),s.appendInto(t)),s.setValue(e),s.commit();};
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
 */"undefined"!=typeof window&&(window.litHtmlVersions||(window.litHtmlVersions=[])).push("1.1.7");const U=(e,...t)=>new _(e,t,"html",z),O=(e,...t)=>new w(e,t,"svg",z);var H=Object.freeze({__proto__:null,html:U,svg:O,DefaultTemplateProcessor:$,defaultTemplateProcessor:z,directive:e,Directive:t,isDirective:n,removeNodes:i,reparentNodes:o,noChange:r,nothing:a,AttributeCommitter:T,AttributePart:Y,BooleanAttributePart:I,EventPart:k,isIterable:P,isPrimitive:N,NodePart:X,PropertyCommitter:C,PropertyPart:V,get sanitizerFactory(){return M},setSanitizerFactory:e=>{if(M!==A)throw new Error("Attempted to overwrite existing lit-html security policy. setSanitizeDOMValueFactory should be called at most once.");M=e;},parts:B,render:W,templateCaches:F,templateFactory:R,TemplateInstance:f,SVGTemplateResult:w,TemplateResult:_,createMarker:v,isTemplatePartActive:u,Template:d});
const ue=document.createElement("template");
class be{constructor(){this.isAction=!0;}}be.prototype.isAction=!0;const _e={element:document.createTextNode(""),axis:"xy",threshold:10,onDown(e){},onMove(e){},onUp(e){},onWheel(e){}};

/**
 * Api functions
 *
 * @copyright Rafal Pospiech <https://neuronet.io>
 * @author    Rafal Pospiech <neuronet.io@gmail.com>
 * @package   gantt-schedule-timeline-calendar
 * @license   AGPL-3.0
 */
const lib = 'gantt-schedule-timeline-calendar';
function getClass(name) {
    let simple = `${lib}__${name}`;
    if (name === lib) {
        simple = lib;
    }
    return simple;
}

/**
 * ItemResizing plugin
 *
 * @copyright Rafal Pospiech <https://neuronet.io>
 * @author    Rafal Pospiech <neuronet.io@gmail.com>
 * @package   gantt-schedule-timeline-calendar
 * @license   AGPL-3.0 (https://github.com/neuronetio/gantt-schedule-timeline-calendar/blob/master/LICENSE)
 * @link      https://github.com/neuronetio/gantt-schedule-timeline-calendar
 */
const lineClass = getClass('chart-timeline-items-row-item-resizing-handle-content-line');
function generateEmptyData$1(options = {}) {
    const events = {
        onStart({ items }) {
            return items.after;
        },
        onResize({ items }) {
            return items.after;
        },
        onEnd({ items }) {
            return items.after;
        },
    };
    const snapToTime = {
        start({ startTime, time }) {
            return startTime.startOf(time.period);
        },
        end({ endTime, time }) {
            return endTime.endOf(time.period);
        },
    };
    const handle = {
        width: 18,
        horizontalMargin: 0,
        verticalMargin: 0,
        outside: false,
        onlyWhenSelected: true,
    };
    const result = Object.assign({ enabled: true, debug: false, state: '', content: null, bodyClass: 'gstc-item-resizing', bodyClassLeft: 'gstc-items-resizing-left', bodyClassRight: 'gstc-items-resizing-right', initialPosition: { x: 0, y: 0 }, currentPosition: { x: 0, y: 0 }, movement: {
            px: 0,
            time: 0,
        }, initialItems: [], targetData: null, leftIsMoving: false, rightIsMoving: false, handle: Object.assign({}, handle), events: Object.assign({}, events), snapToTime: Object.assign({}, snapToTime) }, options);
    if (options.snapToTime)
        result.snapToTime = Object.assign(Object.assign({}, snapToTime), options.snapToTime);
    if (options.events)
        result.events = Object.assign(Object.assign({}, events), options.events);
    if (options.handle)
        result.handle = Object.assign(Object.assign({}, handle), options.handle);
    return result;
}
class ItemResizing {
    constructor(vido, options) {
        this.spacing = 1;
        this.unsubs = [];
        this.vido = vido;
        this.state = vido.state;
        this.api = vido.api;
        this.data = generateEmptyData$1(options);
        this.merge = this.state.get('config.merge');
        this.minWidth = this.data.handle.width * 2;
        this.state.update('config.chart.item.minWidth', this.minWidth);
        this.state.update('config.chart.items.*.minWidth', this.minWidth);
        this.html = vido.html;
        if (!this.data.content)
            this.data.content = this.html `<div class=${lineClass}></div><div class=${lineClass}></div>`;
        this.wrapper = this.wrapper.bind(this);
        this.onRightPointerDown = this.onRightPointerDown.bind(this);
        this.onRightPointerMove = this.onRightPointerMove.bind(this);
        this.onRightPointerUp = this.onRightPointerUp.bind(this);
        this.onLeftPointerDown = this.onLeftPointerDown.bind(this);
        this.onLeftPointerMove = this.onLeftPointerMove.bind(this);
        this.onLeftPointerUp = this.onLeftPointerUp.bind(this);
        this.destroy = this.destroy.bind(this);
        this.updateData();
        document.body.classList.add(this.data.bodyClass);
        this.unsubs.push(this.state.subscribe('config.plugin.ItemResizing', (data) => {
            if (!data.enabled) {
                document.body.classList.remove(this.data.bodyClass);
            }
            else if (data.enabled) {
                document.body.classList.add(this.data.bodyClass);
            }
            this.data = data;
        }));
        document.addEventListener('pointermove', this.onLeftPointerMove);
        document.addEventListener('pointerup', this.onLeftPointerUp);
        document.addEventListener('pointermove', this.onRightPointerMove);
        document.addEventListener('pointerup', this.onRightPointerUp);
        this.state.update('config.wrappers.ChartTimelineItemsRowItem', (oldWrapper) => {
            if (!this.oldWrapper)
                this.oldWrapper = oldWrapper;
            this.initializeWrapper();
            return this.wrapper;
        });
    }
    destroy() {
        this.unsubs.forEach((unsub) => unsub());
        document.removeEventListener('pointermove', this.onLeftPointerMove);
        document.removeEventListener('pointerup', this.onLeftPointerUp);
        document.removeEventListener('pointermove', this.onRightPointerMove);
        document.removeEventListener('pointerup', this.onRightPointerUp);
        if (this.oldWrapper)
            this.state.update('config.wrappers.ChartTimelineItemsRowItem', () => this.oldWrapper);
    }
    updateData() {
        this.state.update('config.plugin.ItemResizing', this.data);
    }
    initializeWrapper() {
        this.leftClassName = this.api.getClass('chart-timeline-items-row-item-resizing-handle');
        this.leftClassName += ' ' + this.leftClassName + '--left';
        this.rightClassName = this.api.getClass('chart-timeline-items-row-item-resizing-handle');
        this.rightClassName += ' ' + this.rightClassName + '--right';
        this.spacing = this.state.get('config.chart.spacing');
    }
    getSelectedItems() {
        return this.state.get(`config.plugin.Selection.selected.${ITEM}`).map((item) => this.merge({}, item));
    }
    getRightStyleMap(item, visible) {
        const rightStyleMap = new this.vido.StyleMap({});
        rightStyleMap.style.top = item.$data.position.actualTop + this.data.handle.verticalMargin + 'px';
        if (this.data.handle.outside) {
            rightStyleMap.style.left = item.$data.position.right + this.data.handle.horizontalMargin - this.spacing + 'px';
        }
        else {
            rightStyleMap.style.left =
                item.$data.position.right - this.data.handle.width - this.data.handle.horizontalMargin - this.spacing + 'px';
        }
        rightStyleMap.style.width = this.data.handle.width + 'px';
        rightStyleMap.style.height = item.$data.actualHeight - this.data.handle.verticalMargin * 2 + 'px';
        return rightStyleMap;
    }
    getLeftStyleMap(item, visible) {
        const leftStyleMap = new this.vido.StyleMap({});
        leftStyleMap.style.top = item.$data.position.actualTop + this.data.handle.verticalMargin + 'px';
        if (this.data.handle.outside) {
            leftStyleMap.style.left =
                item.$data.position.left - this.data.handle.width - this.data.handle.horizontalMargin + 'px';
        }
        else {
            leftStyleMap.style.left = item.$data.position.left + this.data.handle.horizontalMargin + 'px';
        }
        leftStyleMap.style.width = this.data.handle.width + 'px';
        leftStyleMap.style.height = item.$data.actualHeight - this.data.handle.verticalMargin * 2 + 'px';
        return leftStyleMap;
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
                targetData: this.data.targetData,
            },
            vido: this.vido,
            state: this.state,
            time: this.state.get('$data.chart.time'),
        };
    }
    dispatchEvent(type, items) {
        items = items.map((item) => this.merge({}, item));
        const modified = this.data.events[type](this.getEventArgument(items));
        let multi = this.state.multi();
        for (const item of modified) {
            multi = multi
                .update(`config.chart.items.${item.id}.time`, item.time)
                .update(`config.chart.items.${item.id}.$data`, item.$data);
        }
        multi.done();
    }
    getItemsForDiff() {
        const modified = this.getSelectedItems()[0];
        const original = this.data.initialItems.find((initial) => initial.id === modified.id);
        return { modified, original };
    }
    onPointerDown(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        this.data.initialItems = this.getSelectedItems();
        // @ts-ignore
        this.data.targetData = this.merge({}, ev.target.vido);
        this.data.initialPosition = {
            x: ev.screenX,
            y: ev.screenY,
        };
        this.data.currentPosition = Object.assign({}, this.data.initialPosition);
        if (this.data.state === '' || this.data.state === 'end') {
            this.data.state = 'resize';
        }
        this.dispatchEvent('onStart', this.data.initialItems);
    }
    onLeftPointerDown(ev) {
        if (!this.data.enabled)
            return;
        document.body.classList.add(this.data.bodyClassLeft);
        this.onPointerDown(ev);
        this.data.leftIsMoving = true;
        this.updateData();
    }
    onRightPointerDown(ev) {
        if (!this.data.enabled)
            return;
        document.body.classList.add(this.data.bodyClassRight);
        this.onPointerDown(ev);
        this.data.rightIsMoving = true;
        this.updateData();
    }
    onPointerMove(ev) {
        ev.stopPropagation();
        ev.preventDefault();
        this.data.currentPosition.x = ev.screenX;
        this.data.currentPosition.y = ev.screenY;
        this.data.movement.px = this.data.currentPosition.x - this.data.initialPosition.x;
        const { original, modified } = this.getItemsForDiff();
        this.data.movement.time = modified.time.start - original.time.start;
        if (this.data.state === 'resize' || this.data.state === 'start') {
            this.data.state = 'resize';
        }
    }
    onLeftPointerMove(ev) {
        if (!this.data.enabled || !this.data.leftIsMoving)
            return;
        this.onPointerMove(ev);
        const selected = this.getSelectedItems();
        const movement = this.merge({}, this.data.movement);
        const time = this.state.get('$data.chart.time');
        for (let i = 0, len = selected.length; i < len; i++) {
            const item = selected[i];
            item.$data.position.left = this.data.initialItems[i].$data.position.left + movement.px;
            if (item.$data.position.left > item.$data.position.right)
                item.$data.position.left = item.$data.position.right;
            item.$data.position.actualLeft = item.$data.position.left;
            item.$data.width = item.$data.position.right - item.$data.position.left;
            if (item.$data.width < item.minWidth)
                item.$data.width = item.minWidth;
            item.$data.actualWidth = item.$data.width;
            const leftGlobal = this.api.time.getTimeFromViewOffsetPx(item.$data.position.left, time, true);
            const finalLeftGlobalDate = this.data.snapToTime.start({
                startTime: this.api.time.date(leftGlobal),
                item,
                time,
                movement,
                vido: this.vido,
            });
            item.time.start = finalLeftGlobalDate.valueOf();
            item.$data.time.startDate = finalLeftGlobalDate;
        }
        this.dispatchEvent('onResize', selected);
        this.updateData();
    }
    onRightPointerMove(ev) {
        if (!this.data.enabled || !this.data.rightIsMoving)
            return;
        this.onPointerMove(ev);
        const selected = this.getSelectedItems();
        const movement = this.data.movement;
        const time = this.state.get('$data.chart.time');
        for (let i = 0, len = selected.length; i < len; i++) {
            const item = selected[i];
            item.$data.width = this.data.initialItems[i].$data.width + movement.px;
            if (item.$data.width < item.minWidth)
                item.$data.width = item.minWidth;
            const diff = item.$data.position.actualLeft === item.$data.position.left ? 0 : item.$data.position.left;
            item.$data.actualWidth = item.$data.width + diff;
            let right = item.$data.position.left + item.$data.width;
            item.$data.position.right = right;
            item.$data.position.actualRight = right;
            const rightGlobal = this.api.time.getTimeFromViewOffsetPx(right, time, false);
            const finalRightGlobalDate = this.data.snapToTime.end({
                endTime: this.api.time.date(rightGlobal),
                item,
                time,
                movement,
                vido: this.vido,
            });
            item.time.end = finalRightGlobalDate.valueOf();
            item.$data.time.endDate = finalRightGlobalDate;
        }
        this.dispatchEvent('onResize', selected);
        this.updateData();
    }
    onEnd(which) {
        const items = this.getSelectedItems();
        this.dispatchEvent('onEnd', items);
    }
    onPointerUp(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        if (this.data.state === 'resize') {
            this.data.state = 'end';
        }
    }
    onLeftPointerUp(ev) {
        if (!this.data.enabled || !this.data.leftIsMoving)
            return;
        document.body.classList.remove(this.data.bodyClassLeft);
        this.data.leftIsMoving = false;
        this.onPointerUp(ev);
        this.onEnd('left');
        this.updateData();
    }
    onRightPointerUp(ev) {
        if (!this.data.enabled || !this.data.rightIsMoving)
            return;
        document.body.classList.remove(this.data.bodyClassRight);
        this.data.rightIsMoving = false;
        this.onPointerUp(ev);
        this.onEnd('right');
        this.updateData();
    }
    wrapper(input, props) {
        const oldContent = this.oldWrapper(input, props);
        const item = props.props.item;
        let visible = !item.$data.detached;
        if (this.data.handle.onlyWhenSelected) {
            visible = visible && item.selected;
        }
        const rightStyleMap = this.getRightStyleMap(item, visible);
        const leftStyleMap = this.getLeftStyleMap(item, visible);
        const onRightPointerDown = {
            handleEvent: (ev) => this.onRightPointerDown(ev),
        };
        /*const leftHandle = this
          .html`<div class=${this.leftClassName} style=${leftStyleMap} @pointerdown=${onLeftPointerDown}>${this.data.content}</div>`;
        const rightHandle = this
          .html`<div class=${this.rightClassName} style=${rightStyleMap} @pointerdown=${onRightPointerDown}>${this.data.content}</div>`;
        return this.html`${visible ? leftHandle : null}${oldContent}${visible ? rightHandle : null}`;*/
        const rightHandle = this
            .html `<div class=${this.rightClassName} style=${rightStyleMap} @pointerdown=${onRightPointerDown}>${this.data.content}</div>`;
        return this.html `${oldContent}${visible ? rightHandle : null}`;
    }
}
function Plugin$2(options = {}) {
    return function initialize(vidoInstance) {
        const itemResizing = new ItemResizing(vidoInstance, options);
        return itemResizing.destroy;
    };
}

var ItemResizing$1 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  Plugin: Plugin$2
});

/**
 * Selection plugin
 *
 * @copyright Rafal Pospiech <https://neuronet.io>
 * @author    Rafal Pospiech <neuronet.io@gmail.com>
 * @package   gantt-schedule-timeline-calendar
 * @license   AGPL-3.0 (https://github.com/neuronetio/gantt-schedule-timeline-calendar/blob/master/LICENSE)
 * @link      https://github.com/neuronetio/gantt-schedule-timeline-calendar
 */
function prepareOptions$1(options) {
    const defaultOptions = {
        enabled: true,
        cells: true,
        items: true,
        rows: false,
        showOverlay: true,
        rectangularSelection: true,
        multipleSelection: true,
        canSelect(type, currently, all) {
            return currently;
        },
        canDeselect(type, currently, all) {
            return [];
        },
    };
    options = Object.assign(Object.assign({}, defaultOptions), options);
    return options;
}
const pluginPath$2 = 'config.plugin.Selection';
function generateEmptyData$2(options) {
    return Object.assign({ enabled: true, showOverlay: true, isSelecting: false, pointerState: 'up', selectKey: '', multiKey: 'shift', multipleSelection: true, targetType: '', targetData: null, initialPosition: { x: 0, y: 0 }, currentPosition: { x: 0, y: 0 }, selectionAreaLocal: { x: 0, y: 0, width: 0, height: 0 }, selectionAreaGlobal: { x: 0, y: 0, width: 0, height: 0 }, selecting: {
            [ITEM]: [],
            [CELL]: [],
        }, selected: {
            [ITEM]: [],
            [CELL]: [],
        }, automaticallySelected: {
            [ITEM]: [],
            [CELL]: [],
        }, events: {
            down: null,
            move: null,
            up: null,
        } }, options);
}
class SelectionPlugin {
    constructor(vido, options) {
        this.onDestroy = [];
        this.vido = vido;
        this.state = vido.state;
        this.api = vido.api;
        this.merge = this.state.get('config.merge');
        this.state.update(pluginPath$2, generateEmptyData$2(options));
        this.data = generateEmptyData$2(options);
        this.wrapperClassName = this.api.getClass('chart-selection');
        this.wrapperStyleMap = new vido.StyleMap({ display: 'none' });
        this.html = vido.html;
        this.wrapper = this.wrapper.bind(this);
        this.destroy = this.destroy.bind(this);
        this.setWrapper();
        this.onDestroy.push(this.state.subscribe('config.plugin.TimelinePointer', (timelinePointerData) => {
            this.poitnerData = timelinePointerData;
            this.onPointerData();
        }));
        this.updateData();
        this.onDestroy.push(this.state.subscribe(pluginPath$2, (value) => {
            this.data = value;
        }));
        // watch and update items that are inside selection
        this.onDestroy.push(this.state.subscribe('config.chart.items', (items) => {
            this.data.selected[ITEM] = this.data.selected[ITEM].filter((item) => !!items[item.id]).map((item) => this.merge({}, items[item.id]));
        }, { ignore: ['config.chart.items.*.$data.detached', 'config.chart.items.*.selected'] }));
        // TODO: watch and update cells that are inside selection
    }
    setWrapper() {
        this.state.update('config.wrappers.ChartTimelineItems', (oldWrapper) => {
            if (!this.oldWrapper)
                this.oldWrapper = oldWrapper;
            return this.wrapper;
        });
    }
    destroy() {
        this.state.update('config.wrappers.ChartTimelineItems', this.oldWrapper);
        this.oldWrapper = null;
        this.onDestroy.forEach((unsub) => unsub());
    }
    updateData() {
        this.state.update(pluginPath$2, Object.assign({}, this.data));
        this.vido.update(); // draw selection area overlay
    }
    modKeyPressed(modKey, ev) {
        switch (modKey) {
            case 'shift':
                return ev.shiftKey;
            case 'alt':
                return ev.altKey;
            case 'ctrl':
                return ev.ctrlKey;
        }
    }
    canSelect() {
        let result = this.data.enabled;
        const down = this.poitnerData.events.down;
        if (down && this.data.selectKey)
            result = result && this.modKeyPressed(this.data.selectKey, down);
        return result;
    }
    getSelectionAreaLocal() {
        const area = { x: 0, y: 0, width: 0, height: 0 };
        const initial = Object.assign({}, this.poitnerData.initialPosition);
        const current = Object.assign({}, this.poitnerData.currentPosition);
        const width = current.x - initial.x;
        const height = current.y - initial.y;
        if (width >= 0) {
            area.x = initial.x;
            area.width = width;
        }
        else {
            area.x = current.x;
            area.width = Math.abs(width);
        }
        if (height >= 0) {
            area.y = initial.y;
            area.height = height;
        }
        else {
            area.y = current.y;
            area.height = Math.abs(height);
        }
        return area;
    }
    translateAreaLocalToGlobal(localArea) {
        const leftPx = this.state.get('$data.chart.time.leftPx');
        const topPx = this.state.get('config.scroll.vertical.posPx');
        return Object.assign(Object.assign({}, localArea), { x: localArea.x + leftPx, y: localArea.y + topPx });
    }
    collectLinkedItems(item, current = []) {
        if (item.linkedWith && item.linkedWith.length) {
            const items = this.state.get('config.chart.items');
            for (const linkedItemId of item.linkedWith) {
                const linkedItem = items[linkedItemId];
                if (!current.includes(linkedItem)) {
                    current.push(linkedItem);
                    // we don't need to go further because linkedWith property already contains all we need
                }
            }
        }
        return current;
    }
    getSelected(item) {
        let selected;
        let automaticallySelected = this.data.automaticallySelected[ITEM].slice();
        const move = this.poitnerData.events.move;
        const multi = this.data.multiKey && this.modKeyPressed(this.data.multiKey, move);
        const linked = this.collectLinkedItems(item, [item]);
        if (this.data.selected[ITEM].find((selectedItem) => selectedItem.id === item.id)) {
            // if we want to start movement or something - just return currently selected
            selected = this.data.selected[ITEM];
            if (automaticallySelected.find((auto) => auto.id === item.id)) {
                // item under the pointer was automaticallySelected so we must remove it from here
                // - it is not automaticallySelected right now
                // we need to replace current item with one that is linked but doesn't lay down
                // in automaticallySelected currently - we need to switch them
                // first of all we need to find out which item is linked with current but
                // not inside automaticallySelected
                const actualAutoIds = automaticallySelected.map((sel) => sel.id);
                const replaceWith = selected.find((sel) => item.linkedWith.includes(sel.id) && !actualAutoIds.includes(sel.id));
                automaticallySelected = automaticallySelected.filter((currentItem) => currentItem.id !== item.id);
                automaticallySelected.push(replaceWith);
            }
            else {
                automaticallySelected = this.data.automaticallySelected[ITEM];
            }
        }
        else {
            if (multi) {
                selected = [...new Set([...this.data.selected[ITEM], ...linked]).values()];
            }
            else {
                selected = linked;
            }
            automaticallySelected = linked.filter((currentItem) => currentItem.id !== item.id);
        }
        selected = selected.map((item) => {
            item.selected = true;
            return item;
        });
        return { selected, automaticallySelected };
    }
    isItemVerticallyInsideArea(itemData, area) {
        if (!area.width || !area.height)
            return false;
        const areaBottom = area.y + area.height;
        const itemTop = itemData.position.viewTop;
        const itemBottom = itemTop + itemData.actualHeight;
        return ((itemTop >= area.y && itemTop <= areaBottom) ||
            (itemBottom >= area.y && itemBottom <= areaBottom) ||
            (itemTop >= area.y && itemBottom <= areaBottom) ||
            (itemTop <= area.y && itemBottom >= areaBottom));
    }
    isItemHorizontallyInsideArea(itemData, area) {
        if (!area.width || !area.height)
            return false;
        const areaRight = area.x + area.width;
        return ((itemData.position.actualLeft >= area.x && itemData.position.actualLeft <= areaRight) ||
            (itemData.position.actualRight >= area.x && itemData.position.actualRight <= areaRight) ||
            (itemData.position.actualLeft <= area.x && itemData.position.actualRight >= areaRight) ||
            (itemData.position.actualLeft >= area.x && itemData.position.actualRight <= areaRight));
    }
    getItemsUnderSelectionArea(areaLocal) {
        const visibleItems = this.state.get('$data.chart.visibleItems');
        const move = this.poitnerData.events.move;
        const multi = move && this.data.multiKey && this.modKeyPressed(this.data.multiKey, move);
        let selected = multi ? [...this.data.selected[ITEM]] : [];
        const automaticallySelected = multi ? [...this.data.automaticallySelected[ITEM]] : [];
        for (let item of visibleItems) {
            item = this.merge({}, item);
            const itemData = item.$data;
            if (this.isItemVerticallyInsideArea(itemData, areaLocal) &&
                this.isItemHorizontallyInsideArea(itemData, areaLocal)) {
                if (!selected.find((selectedItem) => selectedItem.id === item.id))
                    selected.push(item);
                const linked = this.collectLinkedItems(item, [item]);
                for (let linkedItem of linked) {
                    linkedItem = this.merge({}, linkedItem);
                    if (!selected.find((selectedItem) => selectedItem.id === linkedItem.id)) {
                        selected.push(linkedItem);
                        automaticallySelected.push(linkedItem);
                    }
                }
            }
        }
        selected = selected.map((item) => {
            item.selected = true;
            return item;
        });
        return { selected, automaticallySelected };
    }
    unmarkSelected() {
        const items = this.state.get('config.chart.items');
        let multi = this.state.multi();
        for (const id in items) {
            const item = items[id];
            if (item.selected) {
                multi = multi.update(`config.chart.items.${id}.selected`, false);
            }
        }
        multi.done();
    }
    deselectItems() {
        this.unmarkSelected();
        this.data.selected[ITEM] = [];
        this.updateData();
    }
    selectMultipleCellsAndItems() {
        if (!this.canSelect())
            return;
        if (!this.data.multipleSelection) {
            this.deselectItems();
            return;
        }
        this.data.isSelecting = true;
        this.data.selectionAreaLocal = this.getSelectionAreaLocal();
        this.data.selectionAreaGlobal = this.translateAreaLocalToGlobal(this.data.selectionAreaLocal);
        const { selected, automaticallySelected } = this.getItemsUnderSelectionArea(this.data.selectionAreaLocal);
        this.data.automaticallySelected[ITEM] = automaticallySelected;
        if (selected.length === 0) {
            this.unmarkSelected();
            this.data.selected[ITEM].length = 0;
            return;
        }
        this.data.selected[ITEM] = selected;
        this.unmarkSelected();
        let multi = this.state.multi();
        for (const item of selected) {
            multi = multi.update(`config.chart.items.${item.id}.selected`, true);
        }
        multi.done();
        // TODO save selected cells
    }
    selectItemsIndividually() {
        this.data.isSelecting = false;
        this.data.selectionAreaLocal = this.getSelectionAreaLocal();
        this.data.currentPosition = this.poitnerData.currentPosition;
        this.data.initialPosition = this.poitnerData.initialPosition;
        if (!this.canSelect())
            return;
        const item = this.merge({}, this.poitnerData.targetData);
        let { selected, automaticallySelected } = this.getSelected(item);
        if (selected.length > 1 && !this.data.multipleSelection) {
            selected = [item];
            automaticallySelected = [];
        }
        this.data.selected[ITEM] = selected;
        this.data.automaticallySelected[ITEM] = automaticallySelected;
        this.unmarkSelected();
        let multi = this.state.multi();
        for (const item of this.data.selected[ITEM]) {
            multi = multi.update(`config.chart.items.${item.id}.selected`, true);
        }
        multi.done();
    }
    onPointerData() {
        if (this.poitnerData.isMoving && this.poitnerData.targetType === CELL && this.data.rectangularSelection) {
            this.selectMultipleCellsAndItems();
        }
        else if (this.poitnerData.isMoving && this.poitnerData.targetType === CELL && !this.data.rectangularSelection) {
            this.deselectItems();
        }
        else if (this.poitnerData.isMoving && this.poitnerData.targetType === ITEM) {
            this.selectItemsIndividually();
        }
        else if (!this.poitnerData.isMoving) {
            this.data.isSelecting = false;
        }
        if (this.poitnerData.isMoving && this.poitnerData.targetType !== CELL && this.poitnerData.targetType !== ITEM) {
            this.deselectItems();
        }
        this.data.events = this.poitnerData.events;
        this.data.pointerState = this.poitnerData.pointerState;
        this.data.targetType = this.poitnerData.targetType;
        this.data.targetData = this.poitnerData.targetData;
        this.updateData();
    }
    wrapper(input, props) {
        if (!this.oldWrapper)
            return input;
        const oldContent = this.oldWrapper(input, props);
        let shouldDetach = true;
        if (this.canSelect() &&
            this.data.isSelecting &&
            this.data.showOverlay &&
            this.data.multipleSelection &&
            this.data.rectangularSelection) {
            this.wrapperStyleMap.style.display = 'block';
            this.wrapperStyleMap.style.left = this.data.selectionAreaLocal.x + 'px';
            this.wrapperStyleMap.style.top = this.data.selectionAreaLocal.y + 'px';
            this.wrapperStyleMap.style.width = this.data.selectionAreaLocal.width + 'px';
            this.wrapperStyleMap.style.height = this.data.selectionAreaLocal.height + 'px';
            shouldDetach = false;
        }
        const area = this.html `<div class=${this.wrapperClassName} style=${this.wrapperStyleMap}></div>`;
        return this.html `${oldContent}${shouldDetach ? null : area}`;
    }
}
function Plugin$3(options = {}) {
    options = prepareOptions$1(options);
    return function initialize(vidoInstance) {
        const selectionPlugin = new SelectionPlugin(vidoInstance, options);
        return selectionPlugin.destroy;
    };
}

var Selection = /*#__PURE__*/Object.freeze({
  __proto__: null,
  Plugin: Plugin$3
});

/**
 * CalendarScroll plugin
 *
 * @copyright Rafal Pospiech <https://neuronet.io>
 * @author    Rafal Pospiech <neuronet.io@gmail.com>
 * @package   gantt-schedule-timeline-calendar
 * @license   AGPL-3.0 (https://github.com/neuronetio/gantt-schedule-timeline-calendar/blob/master/LICENSE)
 * @link      https://github.com/neuronetio/gantt-schedule-timeline-calendar
 */
const defaultOptions = {
    enabled: true,
    bodyClassName: 'gstc-scrolling',
};
function Plugin$4(options = defaultOptions) {
    let vido, api, state;
    let enabled = options.enabled;
    class ChartAction {
        constructor(element) {
            this.moving = false;
            this.initialDataIndex = { x: 0, y: 0 };
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
            document.body.classList.add(options.bodyClassName);
            this.moving = true;
            this.resetInitialPoint(ev);
            const scroll = state.get('config.scroll');
            this.initialDataIndex = { x: scroll.horizontal.dataIndex || 0, y: scroll.vertical.dataIndex || 0 };
        }
        pointerUp(ev) {
            if (!enabled)
                return;
            document.body.classList.remove(options.bodyClassName);
            if (this.moving) {
                this.moving = false;
            }
        }
        handleHorizontalMovement(diff, ev) {
            const time = state.get('$data.chart.time');
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
                api.setScrollLeft(i, time);
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
                api.setScrollLeft(i, time);
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
        state.subscribe('config.plugin.CalendarScroll.enabled', (value) => (enabled = value));
        state.update('config.actions.chart-calendar', (chartActions) => {
            chartActions.push(ChartAction);
            return chartActions;
        });
    };
}

var CalendarScroll = /*#__PURE__*/Object.freeze({
  __proto__: null,
  Plugin: Plugin$4
});

/**
 * Weekend highlight plugin
 *
 * @copyright Rafal Pospiech <https://neuronet.io>
 * @author    Rafal Pospiech <neuronet.io@gmail.com>
 * @package   gantt-schedule-timeline-calendar
 * @license   AGPL-3.0 (https://github.com/neuronetio/gantt-schedule-timeline-calendar/blob/master/LICENSE)
 * @link      https://github.com/neuronetio/gantt-schedule-timeline-calendar
 */
function Plugin$5(options = {}) {
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
    return function initialize(vidoInstance) {
        api = vidoInstance.api;
        className = options.className || api.getClass('chart-timeline-grid-row-cell') + '--weekend';
        const destroy = vidoInstance.state.subscribe('$data.chart.time.format.period', (period) => (enabled = period === 'day'));
        vidoInstance.state.update('config.actions.chart-timeline-grid-row-cell', (actions) => {
            actions.push(WeekendHighlightAction);
            return actions;
        });
        return function onDestroy() {
            destroy();
        };
    };
}

var HighlightWeekends = /*#__PURE__*/Object.freeze({
  __proto__: null,
  Plugin: Plugin$5
});

var plugins = { TimelinePointer: TimelinePointer$1, ItemHold: ItemHold$1, ItemMovement: ItemMovement$1, ItemResizing: ItemResizing$1, Selection, CalendarScroll, HighlightWeekends };

export default plugins;
//# sourceMappingURL=plugins.esm.js.map
