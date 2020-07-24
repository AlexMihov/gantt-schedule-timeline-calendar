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
        const currentOptions = vidoInstance.state.get(pluginPath);
        if (currentOptions) {
            options = mergeDeep(mergeDeep({}, options), currentOptions);
        }
        const subs = [];
        const defaultData = generateEmptyData(options);
        // for other plugins that are initialized before elements are saved
        vidoInstance.state.update(pluginPath, defaultData);
        // initialize only if chart element is mounted
        let timelinePointerDestroy;
        subs.push(vidoInstance.state.subscribe('$data.elements.chart-timeline', (timelineElement) => {
            if (timelineElement) {
                if (timelinePointerDestroy)
                    timelinePointerDestroy();
                const timelinePointer = new TimelinePointer(options, vidoInstance);
                timelinePointerDestroy = timelinePointer.destroy;
            }
        }));
        return function destroy() {
            subs.forEach((unsub) => unsub());
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
        const itemData = this.api.getItemData(item.id);
        const positionLeft = this.api.time.getViewOffsetPxFromDates(itemData.time.startDate, false, time);
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
        const startEndTimeDiff = itemData.time.endDate.diff(itemData.time.startDate, 'millisecond');
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
        const rows = this.api.getAllRows();
        const row = rows[item.rowId];
        return row.$data.position.viewTop + this.api.getItemData(item.id).position.actualTop;
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
        const rows = this.api.getAllRows();
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
            console.log('moveItems', moving); // eslint-disable-line no-console
        for (let item of moving) {
            item.rowId = this.moveItemVertically(item).id;
            const newItemTimes = this.getItemMovingTimes(item, time);
            if (newItemTimes.startTime.valueOf() !== item.time.start || newItemTimes.endTime.valueOf() !== item.time.end) {
                item.time.start = newItemTimes.startTime.valueOf();
                item.time.end = newItemTimes.endTime.valueOf();
                const itemData = this.api.getItemData(item.id);
                itemData.time.startDate = newItemTimes.startTime;
                itemData.time.endDate = newItemTimes.endTime;
                this.api.setItemData(item.id, itemData);
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
        this.data.moving = this.selection.selected[ITEM].map((itemId) => this.merge({}, this.api.getItem(itemId)));
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
function Plugin$1(options = {}) {
    return function initialize(vidoInstance) {
        const currentOptions = vidoInstance.state.get(pluginPath$1);
        if (currentOptions) {
            options = mergeDeep({}, options, currentOptions);
        }
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
!function(t,e){module.exports=e();}(commonjsGlobal,function(){var t="millisecond",e="second",n="minute",r="hour",i="day",s="week",u="month",o="quarter",a="year",h=/^(\d{4})-?(\d{1,2})-?(\d{0,2})[^0-9]*(\d{1,2})?:?(\d{1,2})?:?(\d{1,2})?.?(\d{1,3})?$/,f=/\[([^\]]+)]|Y{2,4}|M{1,4}|D{1,2}|d{1,4}|H{1,2}|h{1,2}|a|A|m{1,2}|s{1,2}|Z{1,2}|SSS/g,c=function(t,e,n){var r=String(t);return !r||r.length>=e?t:""+Array(e+1-r.length).join(n)+t},d={s:c,z:function(t){var e=-t.utcOffset(),n=Math.abs(e),r=Math.floor(n/60),i=n%60;return (e<=0?"+":"-")+c(r,2,"0")+":"+c(i,2,"0")},m:function(t,e){var n=12*(e.year()-t.year())+(e.month()-t.month()),r=t.clone().add(n,u),i=e-r<0,s=t.clone().add(n+(i?-1:1),u);return Number(-(n+(e-r)/(i?r-s:s-r))||0)},a:function(t){return t<0?Math.ceil(t)||0:Math.floor(t)},p:function(h){return {M:u,y:a,w:s,d:i,D:"date",h:r,m:n,s:e,ms:t,Q:o}[h]||String(h||"").toLowerCase().replace(/s$/,"")},u:function(t){return void 0===t}},$={name:"en",weekdays:"Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday".split("_"),months:"January_February_March_April_May_June_July_August_September_October_November_December".split("_")},l="en",m={};m[l]=$;var y=function(t){return t instanceof v},M=function(t,e,n){var r;if(!t)return l;if("string"==typeof t)m[t]&&(r=t),e&&(m[t]=e,r=t);else {var i=t.name;m[i]=t,r=i;}return !n&&r&&(l=r),r||!n&&l},g=function(t,e){if(y(t))return t.clone();var n="object"==typeof e?e:{};return n.date=t,n.args=arguments,new v(n)},D=d;D.l=M,D.i=y,D.w=function(t,e){return g(t,{locale:e.$L,utc:e.$u,$offset:e.$offset})};var v=function(){function c(t){this.$L=this.$L||M(t.locale,null,!0),this.parse(t);}var d=c.prototype;return d.parse=function(t){this.$d=function(t){var e=t.date,n=t.utc;if(null===e)return new Date(NaN);if(D.u(e))return new Date;if(e instanceof Date)return new Date(e);if("string"==typeof e&&!/Z$/i.test(e)){var r=e.match(h);if(r)return n?new Date(Date.UTC(r[1],r[2]-1,r[3]||1,r[4]||0,r[5]||0,r[6]||0,r[7]||0)):new Date(r[1],r[2]-1,r[3]||1,r[4]||0,r[5]||0,r[6]||0,r[7]||0)}return new Date(e)}(t),this.init();},d.init=function(){var t=this.$d;this.$y=t.getFullYear(),this.$M=t.getMonth(),this.$D=t.getDate(),this.$W=t.getDay(),this.$H=t.getHours(),this.$m=t.getMinutes(),this.$s=t.getSeconds(),this.$ms=t.getMilliseconds();},d.$utils=function(){return D},d.isValid=function(){return !("Invalid Date"===this.$d.toString())},d.isSame=function(t,e){var n=g(t);return this.startOf(e)<=n&&n<=this.endOf(e)},d.isAfter=function(t,e){return g(t)<this.startOf(e)},d.isBefore=function(t,e){return this.endOf(e)<g(t)},d.$g=function(t,e,n){return D.u(t)?this[e]:this.set(n,t)},d.year=function(t){return this.$g(t,"$y",a)},d.month=function(t){return this.$g(t,"$M",u)},d.day=function(t){return this.$g(t,"$W",i)},d.date=function(t){return this.$g(t,"$D","date")},d.hour=function(t){return this.$g(t,"$H",r)},d.minute=function(t){return this.$g(t,"$m",n)},d.second=function(t){return this.$g(t,"$s",e)},d.millisecond=function(e){return this.$g(e,"$ms",t)},d.unix=function(){return Math.floor(this.valueOf()/1e3)},d.valueOf=function(){return this.$d.getTime()},d.startOf=function(t,o){var h=this,f=!!D.u(o)||o,c=D.p(t),d=function(t,e){var n=D.w(h.$u?Date.UTC(h.$y,e,t):new Date(h.$y,e,t),h);return f?n:n.endOf(i)},$=function(t,e){return D.w(h.toDate()[t].apply(h.toDate("s"),(f?[0,0,0,0]:[23,59,59,999]).slice(e)),h)},l=this.$W,m=this.$M,y=this.$D,M="set"+(this.$u?"UTC":"");switch(c){case a:return f?d(1,0):d(31,11);case u:return f?d(1,m):d(0,m+1);case s:var g=this.$locale().weekStart||0,v=(l<g?l+7:l)-g;return d(f?y-v:y+(6-v),m);case i:case"date":return $(M+"Hours",0);case r:return $(M+"Minutes",1);case n:return $(M+"Seconds",2);case e:return $(M+"Milliseconds",3);default:return this.clone()}},d.endOf=function(t){return this.startOf(t,!1)},d.$set=function(s,o){var h,f=D.p(s),c="set"+(this.$u?"UTC":""),d=(h={},h[i]=c+"Date",h.date=c+"Date",h[u]=c+"Month",h[a]=c+"FullYear",h[r]=c+"Hours",h[n]=c+"Minutes",h[e]=c+"Seconds",h[t]=c+"Milliseconds",h)[f],$=f===i?this.$D+(o-this.$W):o;if(f===u||f===a){var l=this.clone().set("date",1);l.$d[d]($),l.init(),this.$d=l.set("date",Math.min(this.$D,l.daysInMonth())).toDate();}else d&&this.$d[d]($);return this.init(),this},d.set=function(t,e){return this.clone().$set(t,e)},d.get=function(t){return this[D.p(t)]()},d.add=function(t,o){var h,f=this;t=Number(t);var c=D.p(o),d=function(e){var n=g(f);return D.w(n.date(n.date()+Math.round(e*t)),f)};if(c===u)return this.set(u,this.$M+t);if(c===a)return this.set(a,this.$y+t);if(c===i)return d(1);if(c===s)return d(7);var $=(h={},h[n]=6e4,h[r]=36e5,h[e]=1e3,h)[c]||1,l=this.$d.getTime()+t*$;return D.w(l,this)},d.subtract=function(t,e){return this.add(-1*t,e)},d.format=function(t){var e=this;if(!this.isValid())return "Invalid Date";var n=t||"YYYY-MM-DDTHH:mm:ssZ",r=D.z(this),i=this.$locale(),s=this.$H,u=this.$m,o=this.$M,a=i.weekdays,h=i.months,c=function(t,r,i,s){return t&&(t[r]||t(e,n))||i[r].substr(0,s)},d=function(t){return D.s(s%12||12,t,"0")},$=i.meridiem||function(t,e,n){var r=t<12?"AM":"PM";return n?r.toLowerCase():r},l={YY:String(this.$y).slice(-2),YYYY:this.$y,M:o+1,MM:D.s(o+1,2,"0"),MMM:c(i.monthsShort,o,h,3),MMMM:c(h,o),D:this.$D,DD:D.s(this.$D,2,"0"),d:String(this.$W),dd:c(i.weekdaysMin,this.$W,a,2),ddd:c(i.weekdaysShort,this.$W,a,3),dddd:a[this.$W],H:String(s),HH:D.s(s,2,"0"),h:d(1),hh:d(2),a:$(s,u,!0),A:$(s,u,!1),m:String(u),mm:D.s(u,2,"0"),s:String(this.$s),ss:D.s(this.$s,2,"0"),SSS:D.s(this.$ms,3,"0"),Z:r};return n.replace(f,function(t,e){return e||l[t]||r.replace(":","")})},d.utcOffset=function(){return 15*-Math.round(this.$d.getTimezoneOffset()/15)},d.diff=function(t,h,f){var c,d=D.p(h),$=g(t),l=6e4*($.utcOffset()-this.utcOffset()),m=this-$,y=D.m(this,$);return y=(c={},c[a]=y/12,c[u]=y,c[o]=y/3,c[s]=(m-l)/6048e5,c[i]=(m-l)/864e5,c[r]=m/36e5,c[n]=m/6e4,c[e]=m/1e3,c)[d]||m,f?y:D.a(y)},d.daysInMonth=function(){return this.endOf(u).$D},d.$locale=function(){return m[this.$L]},d.locale=function(t,e){if(!t)return this.$L;var n=this.clone(),r=M(t,e,!0);return r&&(n.$L=r),n},d.clone=function(){return D.w(this.$d,this)},d.toDate=function(){return new Date(this.valueOf())},d.toJSON=function(){return this.isValid()?this.toISOString():null},d.toISOString=function(){return this.$d.toISOString()},d.toString=function(){return this.$d.toUTCString()},c}();return g.prototype=v.prototype,g.extend=function(t,e){return t(e,v,g),g},g.locale=M,g.isDayjs=y,g.unix=function(t){return g(1e3*t)},g.en=m[l],g.Ls=m,g});
});

var utc = createCommonjsModule(function (module, exports) {
!function(t,i){module.exports=i();}(commonjsGlobal,function(){return function(t,i,e){var s=(new Date).getTimezoneOffset(),n=i.prototype;e.utc=function(t){return new i({date:t,utc:!0,args:arguments})},n.utc=function(){return e(this.toDate(),{locale:this.$L,utc:!0})},n.local=function(){return e(this.toDate(),{locale:this.$L,utc:!1})};var u=n.parse;n.parse=function(t){t.utc&&(this.$u=!0),this.$utils().u(t.$offset)||(this.$offset=t.$offset),u.call(this,t);};var o=n.init;n.init=function(){if(this.$u){var t=this.$d;this.$y=t.getUTCFullYear(),this.$M=t.getUTCMonth(),this.$D=t.getUTCDate(),this.$W=t.getUTCDay(),this.$H=t.getUTCHours(),this.$m=t.getUTCMinutes(),this.$s=t.getUTCSeconds(),this.$ms=t.getUTCMilliseconds();}else o.call(this);};var f=n.utcOffset;n.utcOffset=function(t){var i=this.$utils().u;if(i(t))return this.$u?0:i(this.$offset)?f.call(this):this.$offset;var e,n=Math.abs(t)<=16?60*t:t;return 0!==t?(e=this.local().add(n+s,"minute")).$offset=n:e=this.utc(),e};var r=n.format;n.format=function(t){var i=t||(this.$u?"YYYY-MM-DDTHH:mm:ss[Z]":"");return r.call(this,i)},n.valueOf=function(){var t=this.$utils().u(this.$offset)?0:this.$offset+s;return this.$d.valueOf()-6e4*t},n.isUTC=function(){return !!this.$u},n.toISOString=function(){return this.toDate().toISOString()},n.toString=function(){return this.toDate().toUTCString()};var a=n.toDate;n.toDate=function(t){return "s"===t&&this.$offset?e(this.format("YYYY-MM-DD HH:mm:ss:SSS")).toDate():a.call(this)};}});
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
 * Used to clone existing node instead of each time creating new one which is
 * slower
 */
const emptyTemplateNode = document.createElement('template');

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
const isBrowser$1 = typeof window !== 'undefined';
if (isBrowser$1) {
    // If we run in the browser set version
    (window['litHtmlVersions'] || (window['litHtmlVersions'] = [])).push('1.1.7');
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
var __asyncValues = (undefined && undefined.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};

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
var __asyncValues$1 = (undefined && undefined.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};

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
 * Used to clone existing node instead of each time creating new one which is
 * slower
 */
const emptyTemplateNode$1 = document.createElement('template');

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
 * Api functions
 *
 * @copyright Rafal Pospiech <https://neuronet.io>
 * @author    Rafal Pospiech <neuronet.io@gmail.com>
 * @package   gantt-schedule-timeline-calendar
 * @license   AGPL-3.0
 */
const lib = 'gstc';
function getClass(name, appendix = '') {
    let simple = `${lib}__${name}`;
    if (name === lib) {
        simple = lib;
    }
    if (appendix)
        return `${simple} ${simple}--${appendix.replace(':', '-')}`;
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
        }, initialItems: [], initialItemsData: {}, targetData: null, leftIsMoving: false, rightIsMoving: false, handle: Object.assign({}, handle), events: Object.assign({}, events), snapToTime: Object.assign({}, snapToTime) }, options);
    if (options.snapToTime)
        result.snapToTime = Object.assign(Object.assign({}, snapToTime), options.snapToTime);
    if (options.events)
        result.events = Object.assign(Object.assign({}, events), options.events);
    if (options.handle)
        result.handle = Object.assign(Object.assign({}, handle), options.handle);
    return result;
}
const pluginPath$2 = 'config.plugin.ItemResizing';
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
        return this.state
            .get(`config.plugin.Selection.selected.${ITEM}`)
            .map((itemId) => this.merge({}, this.api.getItem(itemId)));
    }
    getSelectedItemsData(selectedItems) {
        const itemsData = {};
        for (const item of selectedItems) {
            itemsData[item.id] = this.merge({}, this.api.getItemData(item.id));
        }
        return itemsData;
    }
    getRightStyleMap(item) {
        const rightStyleMap = new this.vido.StyleMap({});
        const itemData = this.api.getItemData(item.id);
        rightStyleMap.style.top = itemData.position.actualTop + this.data.handle.verticalMargin + 'px';
        if (this.data.handle.outside) {
            rightStyleMap.style.left = itemData.position.right + this.data.handle.horizontalMargin - this.spacing + 'px';
        }
        else {
            rightStyleMap.style.left =
                itemData.position.right - this.data.handle.width - this.data.handle.horizontalMargin - this.spacing + 'px';
        }
        rightStyleMap.style.width = this.data.handle.width + 'px';
        rightStyleMap.style.height = itemData.actualHeight - this.data.handle.verticalMargin * 2 + 'px';
        return rightStyleMap;
    }
    getLeftStyleMap(item) {
        const leftStyleMap = new this.vido.StyleMap({});
        const itemData = this.api.getItemData(item.id);
        leftStyleMap.style.top = itemData.position.actualTop + this.data.handle.verticalMargin + 'px';
        if (this.data.handle.outside) {
            leftStyleMap.style.left =
                itemData.position.left - this.data.handle.width - this.data.handle.horizontalMargin + 'px';
        }
        else {
            leftStyleMap.style.left = itemData.position.left + this.data.handle.horizontalMargin + 'px';
        }
        leftStyleMap.style.width = this.data.handle.width + 'px';
        leftStyleMap.style.height = itemData.actualHeight - this.data.handle.verticalMargin * 2 + 'px';
        return leftStyleMap;
    }
    getEventArgument(afterItems) {
        const configItems = this.api.getAllItems();
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
    dispatchEvent(type, items, itemData = null) {
        items = items.map((item) => this.merge({}, item));
        const modified = this.data.events[type](this.getEventArgument(items));
        let multi = this.state.multi();
        for (const item of modified) {
            multi = multi.update(`config.chart.items.${item.id}.time`, item.time);
            if (itemData)
                multi = multi.update(`$data.chart.items.${item.id}`, itemData[item.id]);
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
        this.data.initialItemsData = this.getSelectedItemsData(this.data.initialItems);
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
        const itemDataToSave = {};
        const movement = this.data.movement;
        const time = this.state.get('$data.chart.time');
        for (let i = 0, len = selected.length; i < len; i++) {
            const item = selected[i];
            const itemData = this.merge({}, this.data.initialItemsData[item.id]);
            itemData.position.left = itemData.position.left + movement.px;
            if (itemData.position.left > itemData.position.right - item.minWidth)
                itemData.position.left = itemData.position.right - item.minWidth;
            const leftGlobal = this.api.time.getTimeFromViewOffsetPx(itemData.position.left, time, true);
            itemData.width = itemData.position.right - itemData.position.left;
            if (itemData.width < item.minWidth)
                itemData.width = item.minWidth;
            itemData.actualWidth = itemData.width;
            const finalLeftGlobalDate = this.data.snapToTime.start({
                startTime: this.api.time.date(leftGlobal),
                item,
                time,
                movement,
                vido: this.vido,
            });
            item.time.start = finalLeftGlobalDate.valueOf();
            itemData.time.startDate = finalLeftGlobalDate;
            itemDataToSave[item.id] = itemData;
        }
        this.dispatchEvent('onResize', selected, itemDataToSave);
        this.updateData();
    }
    onRightPointerMove(ev) {
        if (!this.data.enabled || !this.data.rightIsMoving)
            return;
        this.onPointerMove(ev);
        const selected = this.getSelectedItems();
        const itemDataToSave = {};
        const movement = this.data.movement;
        const time = this.state.get('$data.chart.time');
        for (let i = 0, len = selected.length; i < len; i++) {
            const item = selected[i];
            const itemData = this.merge({}, this.data.initialItemsData[item.id]);
            itemData.position.right = itemData.position.right + movement.px;
            if (itemData.position.right < itemData.position.left + item.minWidth)
                itemData.position.right = itemData.position.left + item.minWidth;
            const rightGlobal = this.api.time.getTimeFromViewOffsetPx(itemData.position.right, time, false);
            itemData.width = itemData.position.right - itemData.position.left;
            if (itemData.width < item.minWidth)
                itemData.width = item.minWidth;
            itemData.actualWidth = itemData.width;
            const finalRightGlobalDate = this.data.snapToTime.end({
                endTime: this.api.time.date(rightGlobal),
                item,
                time,
                movement,
                vido: this.vido,
            });
            item.time.end = finalRightGlobalDate.valueOf();
            itemData.time.endDate = finalRightGlobalDate;
            itemDataToSave[item.id] = itemData;
        }
        this.dispatchEvent('onResize', selected, itemDataToSave);
        this.updateData();
    }
    onEnd() {
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
        this.onEnd();
        this.updateData();
    }
    onRightPointerUp(ev) {
        if (!this.data.enabled || !this.data.rightIsMoving)
            return;
        document.body.classList.remove(this.data.bodyClassRight);
        this.data.rightIsMoving = false;
        this.onPointerUp(ev);
        this.onEnd();
        this.updateData();
    }
    wrapper(input, props) {
        const oldContent = this.oldWrapper(input, props);
        const item = props.props.item;
        let visible = !this.api.getItemData(item.id).detached;
        if (this.data.handle.onlyWhenSelected) {
            visible = visible && item.selected;
        }
        const rightStyleMap = this.getRightStyleMap(item);
        const leftStyleMap = this.getLeftStyleMap(item); // eslint-disable-line no-unused-vars, @typescript-eslint/no-unused-vars
        // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
        const onLeftPointerDown = {
            handleEvent: (ev) => this.onLeftPointerDown(ev),
        };
        const onRightPointerDown = {
            handleEvent: (ev) => this.onRightPointerDown(ev),
        };
        const leftHandle = this
            .html `<div class=${this.leftClassName} style=${leftStyleMap} @pointerdown=${onLeftPointerDown}>${this.data.content}</div>`;
        const rightHandle = this
            .html `<div class=${this.rightClassName} style=${rightStyleMap} @pointerdown=${onRightPointerDown}>${this.data.content}</div>`;
        return this.html `${visible ? leftHandle : null}${oldContent}${visible ? rightHandle : null}`;
    }
}
function Plugin$2(options = {}) {
    return function initialize(vidoInstance) {
        const currentOptions = vidoInstance.state.get(pluginPath$2);
        if (currentOptions) {
            options = mergeDeep({}, options, currentOptions);
        }
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
        selectedClassName: 'gstc__grid-cell-selected',
        selectingClassName: 'gstc__grid-cell-selecting',
        onSelecting(selecting) {
            return selecting;
        },
        onSelected(selected) {
            return selected;
        },
    };
    options = Object.assign(Object.assign({}, defaultOptions), options);
    return options;
}
const pluginPath$3 = 'config.plugin.Selection';
function generateEmptyData$2(options) {
    return Object.assign({ enabled: true, showOverlay: true, isSelecting: false, pointerState: 'up', selectKey: '', multiKey: 'shift', multipleSelection: true, targetType: '', targetData: null, initialPosition: { x: 0, y: 0 }, currentPosition: { x: 0, y: 0 }, selectionAreaLocal: { x: 0, y: 0, width: 0, height: 0 }, selectionAreaGlobal: { x: 0, y: 0, width: 0, height: 0 }, selecting: {
            [ITEM]: [],
            [CELL]: [],
        }, selected: {
            [ITEM]: [],
            [CELL]: [],
        }, lastSelected: {
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
        this.state.update(pluginPath$3, generateEmptyData$2(options));
        this.data = generateEmptyData$2(options);
        this.wrapperClassName = this.api.getClass('chart-selection');
        this.wrapperStyleMap = new vido.StyleMap({ display: 'none' });
        this.html = vido.html;
        this.wrapper = this.wrapper.bind(this);
        this.destroy = this.destroy.bind(this);
        this.setWrapper();
        this.onCellCreate = this.onCellCreate.bind(this);
        this.apiGetSelection = this.apiGetSelection.bind(this);
        this.apiGetSelecting = this.apiGetSelecting.bind(this);
        this.apiGetSelected = this.apiGetSelected.bind(this);
        this.apiSetSelection = this.apiSetSelection.bind(this);
        this.apiSelectCells = this.apiSelectCells.bind(this);
        this.apiSelectItems = this.apiSelectItems.bind(this);
        this.api.plugins.selection = {
            getSelection: this.apiGetSelection,
            getSelected: this.apiGetSelected,
            getSelecting: this.apiGetSelecting,
            setSelection: this.apiSetSelection,
            selectCells: this.apiSelectCells,
            selectItems: this.apiSelectItems,
        };
        this.state.update('config.chart.grid.cell.onCreate', (onCreate) => {
            if (!onCreate.includes(this.onCellCreate))
                onCreate.push(this.onCellCreate);
            return onCreate;
        });
        this.onDestroy.push(this.state.subscribe('config.plugin.TimelinePointer', (timelinePointerData) => {
            this.pointerData = timelinePointerData;
            this.onPointerData();
        }));
        this.updateData();
        this.onDestroy.push(this.state.subscribe(pluginPath$3, (value) => {
            this.data = value;
        }));
        this.updateCellSelectionClassName = this.updateCellSelectionClassName.bind(this);
        this.selectedCellAction = this.selectedCellAction.bind(this);
        this.state.update('config.actions.chart-timeline-grid-row-cell', (actions) => {
            if (!actions.includes(this.selectedCellAction))
                actions.push(this.selectedCellAction);
            return actions;
        });
        // watch and update items/cells that are inside selection
        // remove ones that no longer exist
        // for cells we cannot do that because cells are created dynamically
        this.onDestroy.push(this.state.subscribe('config.chart.items', (items) => {
            this.data.selected[ITEM] = this.data.selected[ITEM].filter((itemId) => !!items[itemId]);
            this.data.selecting[ITEM] = this.data.selecting[ITEM].filter((itemId) => !!items[itemId]);
        }, {
            ignore: ['$data.chart.items.*.detached', 'config.chart.items.*.selected', 'config.chart.items.*.selecting'],
        }));
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
        this.state.update('config.actions.chart-timeline-grid-row-cell', (actions) => {
            return actions.filter((action) => action !== this.selectedCellAction);
        });
        this.state.update('config.chart.grid.cell.onCreate', (onCreate) => {
            return onCreate.filter((onCreateFn) => onCreateFn !== this.onCellCreate);
        });
        this.oldWrapper = null;
        this.onDestroy.forEach((unsub) => unsub());
    }
    updateData() {
        this.state.update(pluginPath$3, Object.assign({}, this.data));
        this.vido.update(); // draw selection area overlay
    }
    apiSetSelection(selection) {
        this.data.selected = this.api.mergeDeep({}, selection);
        let multi = this.state.multi();
        multi = this.updateCells(multi);
        multi = this.updateItems(multi);
        multi.done();
        this.updateData();
    }
    apiSelectCells(cellsId) {
        this.data.selected[CELL] = [...cellsId];
        let multi = this.state.multi();
        multi = this.updateCells(multi);
        multi.done();
        this.updateData();
    }
    apiSelectItems(itemsId) {
        this.data.selected[ITEM] = [...itemsId];
        let multi = this.state.multi();
        multi = this.updateItems(multi);
        multi.done();
        this.updateData();
    }
    apiGetSelection() {
        return {
            selecting: this.getSelectionWithData(this.data.selecting),
            selected: this.getSelectionWithData(this.data.selected),
        };
    }
    apiGetSelecting() {
        return this.getSelectionWithData(this.data.selecting);
    }
    apiGetSelected() {
        return this.getSelectionWithData(this.data.selected);
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
        const downEvent = this.pointerData.events.down;
        if (downEvent && this.data.selectKey)
            result = result && this.modKeyPressed(this.data.selectKey, downEvent);
        return result;
    }
    getSelectionAreaLocal() {
        const area = { x: 0, y: 0, width: 0, height: 0 };
        const initial = Object.assign({}, this.pointerData.initialPosition);
        const current = Object.assign({}, this.pointerData.currentPosition);
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
            const items = this.api.getAllItems();
            for (const linkedItemId of item.linkedWith) {
                const linkedItem = items[linkedItemId];
                if (!current.includes(linkedItem.id)) {
                    current.push(linkedItem.id);
                    // we don't need to go further because linkedWith property already contains all we need
                }
            }
        }
        return current;
    }
    getSelectedItem(item) {
        let selected;
        let automaticallySelected = this.data.automaticallySelected[ITEM].slice();
        const linked = this.collectLinkedItems(item, [item.id]);
        if (this.data.selected[ITEM].find((selectedItemId) => selectedItemId === item.id)) {
            // if we want to start movement or something - just return currently selected
            selected = this.data.selected[ITEM];
            if (automaticallySelected.find((autoId) => autoId === item.id)) {
                // item under the pointer was automaticallySelected so we must remove it from here
                // - it is not automaticallySelected right now
                // we need to replace current item with one that is linked but doesn't lay down
                // in automaticallySelected currently - we need to switch them
                // first of all we need to find out which item is linked with current but
                // not inside automaticallySelected
                const actualAutoIds = automaticallySelected;
                const replaceWith = selected.find((selId) => item.linkedWith.includes(selId) && !actualAutoIds.includes(selId));
                automaticallySelected = automaticallySelected.filter((currentItemId) => currentItemId !== item.id);
                automaticallySelected.push(replaceWith);
            }
            else {
                automaticallySelected = this.data.automaticallySelected[ITEM];
            }
        }
        else {
            if (this.isMulti()) {
                selected = Array.from(new Set([...this.data.selected[ITEM], ...linked]));
            }
            else {
                selected = linked;
            }
            automaticallySelected = linked.filter((currentItemId) => currentItemId !== item.id);
        }
        selected = selected.map((itemId) => {
            item = this.api.getItem(itemId);
            item.selected = true;
            return itemId;
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
    isMulti() {
        const move = this.pointerData.events.move;
        return move && this.data.multiKey && this.modKeyPressed(this.data.multiKey, move);
    }
    getItemsUnderSelectionArea(areaLocal) {
        const visibleItemsId = this.state.get('$data.chart.visibleItems');
        const visibleItems = this.api.getItems(visibleItemsId);
        let selectedItems = [];
        const automaticallySelectedItems = [];
        for (let item of visibleItems) {
            item = this.merge({}, item);
            const itemData = this.api.getItemData(item.id);
            if (this.isItemVerticallyInsideArea(itemData, areaLocal) &&
                this.isItemHorizontallyInsideArea(itemData, areaLocal)) {
                if (!selectedItems.find((selectedItemId) => selectedItemId === item.id))
                    selectedItems.push(item.id);
                const linked = this.collectLinkedItems(item, [item.id]);
                for (let linkedItemId of linked) {
                    const linkedItem = this.api.getItem(linkedItemId);
                    if (!selectedItems.find((selectedItemId) => selectedItemId === linkedItem.id)) {
                        selectedItems.push(linkedItem.id);
                        automaticallySelectedItems.push(linkedItem.id);
                    }
                }
            }
        }
        selectedItems = selectedItems.map((itemId) => {
            const item = this.api.getItem(itemId);
            item.selected = true;
            return itemId;
        });
        return { selectedItems, automaticallySelectedItems };
    }
    isCellVerticallyInsideArea(cell, area) {
        if (!area.width || !area.height)
            return false;
        const areaBottom = area.y + area.height;
        const top = cell.top;
        const bottom = top + cell.row.$data.actualHeight;
        return ((top >= area.y && top <= areaBottom) ||
            (bottom >= area.y && bottom <= areaBottom) ||
            (top >= area.y && bottom <= areaBottom) ||
            (top <= area.y && bottom >= areaBottom));
    }
    isCellHorizontallyInsideArea(cell, area) {
        if (!area.width || !area.height)
            return false;
        const areaRight = area.x + area.width;
        const left = cell.time.currentView.leftPx;
        const right = cell.time.currentView.rightPx;
        return ((left >= area.x && left <= areaRight) ||
            (right >= area.x && right <= areaRight) ||
            (left <= area.x && right >= areaRight) ||
            (left >= area.x && right <= areaRight));
    }
    getCellsUnderSelectionArea(areaLocal) {
        const cells = this.state.get('$data.chart.grid.cells');
        const selectedCells = [];
        for (const cellId in cells) {
            const cell = cells[cellId];
            if (this.isCellVerticallyInsideArea(cell, areaLocal) && this.isCellHorizontallyInsideArea(cell, areaLocal)) {
                if (!selectedCells.find((selectedCell) => selectedCell === cell.id))
                    selectedCells.push(cell.id);
            }
        }
        return { selectedCells };
    }
    updateItems(multi) {
        const allItems = this.api.getItems();
        const currentlySelectingItemsStr = allItems
            .filter((item) => item.selecting)
            .map((item) => item.id)
            .join('|');
        const selectingItemsStr = this.data.selecting[ITEM].join('|');
        const currentlySelectedItemsStr = allItems
            .filter((item) => item.selected)
            .map((item) => item.id)
            .join('|');
        const selectedItemsStr = this.data.selected[ITEM].join('|');
        if (currentlySelectingItemsStr === selectingItemsStr && currentlySelectedItemsStr === selectedItemsStr)
            return multi;
        multi = multi.update('config.chart.items.*.selected', false);
        multi = multi.update('config.chart.items.*.selecting', false);
        const itemsId = Array.from(new Set([...this.data.selecting[ITEM], ...this.data.selected[ITEM]]));
        for (const itemId of itemsId) {
            const selecting = this.data.selecting[ITEM].includes(itemId);
            const selected = this.data.selected[ITEM].includes(itemId);
            multi = multi.update(`config.chart.items.${itemId}.selecting`, selecting);
            multi = multi.update(`config.chart.items.${itemId}.selected`, selected);
        }
        return multi;
    }
    updateCells(multi) {
        const allCells = this.api.getGridCells();
        const currentlySelectingCellsStr = allCells
            .filter((cell) => cell.selecting)
            .map((cell) => cell.id)
            .join('|');
        const selectingCellsStr = this.data.selecting[CELL].join('|');
        const currentlySelectedCellsStr = allCells
            .filter((cell) => cell.selected)
            .map((cell) => cell.id)
            .join('|');
        const selectedCellsStr = this.data.selected[CELL].join('|');
        if (currentlySelectingCellsStr === selectingCellsStr && currentlySelectedCellsStr === selectedCellsStr)
            return multi;
        multi.update('$data.chart.grid.cells', (cells) => {
            for (const cellId in cells) {
                const cell = cells[cellId];
                cell.selected = this.data.selected[CELL].includes(cell.id);
                cell.selecting = this.data.selecting[CELL].includes(cell.id);
            }
            return cells;
        });
        return multi;
    }
    deselectItems() {
        this.data.selected[ITEM].length = 0;
        this.data.selecting[ITEM].length = 0;
        let multi = this.state.multi();
        multi = this.updateItems(multi);
        multi.done();
    }
    deselectCells() {
        this.data.selecting[CELL].length = 0;
        this.data.selected[CELL].length = 0;
        let multi = this.state.multi();
        multi = this.updateCells(multi);
        multi.done();
    }
    getSelectionWithData(selection) {
        const items = this.state.get('config.chart.items');
        const cells = this.state.get('$data.chart.grid.cells');
        return {
            [CELL]: selection[CELL].map((cellId) => cells[cellId]),
            [ITEM]: selection[ITEM].map((itemId) => items[itemId]),
        };
    }
    // send cell and item data to event - not just id
    onSelecting(selecting, last) {
        const selectingWithData = this.getSelectionWithData(selecting);
        const lastWithData = this.getSelectionWithData(last);
        const result = this.data.onSelecting(selectingWithData, lastWithData);
        return {
            [CELL]: result[CELL].map((cell) => cell.id),
            [ITEM]: result[ITEM].map((item) => item.id),
        };
    }
    // send cell and item data to event - not just id
    onSelected(selected, last) {
        const selectedWithData = this.getSelectionWithData(selected);
        const lastWithData = this.getSelectionWithData(last);
        const result = this.data.onSelected(selectedWithData, lastWithData);
        return {
            [CELL]: result[CELL].map((cell) => cell.id),
            [ITEM]: result[ITEM].map((item) => item.id),
        };
    }
    selectMultipleCellsAndItems() {
        if (!this.canSelect())
            return;
        if (!this.data.multipleSelection) {
            this.deselectItems();
            this.deselectCells();
            this.updateData();
            return;
        }
        this.data.isSelecting = true;
        this.data.selectionAreaLocal = this.getSelectionAreaLocal();
        this.data.selectionAreaGlobal = this.translateAreaLocalToGlobal(this.data.selectionAreaLocal);
        let selecting = {
            [CELL]: [],
            [ITEM]: [],
        };
        const isMulti = this.isMulti();
        const { selectedCells } = this.getCellsUnderSelectionArea(this.data.selectionAreaLocal);
        if (selectedCells.length === 0) {
            selecting[CELL].length = 0;
            if (!isMulti)
                this.data.selected[CELL].length = 0;
        }
        else {
            selecting[CELL] = selectedCells;
        }
        const { selectedItems, automaticallySelectedItems } = this.getItemsUnderSelectionArea(this.data.selectionAreaLocal);
        this.data.automaticallySelected[ITEM] = automaticallySelectedItems;
        if (selectedItems.length === 0) {
            selecting[ITEM].length = 0;
            if (!isMulti)
                this.data.selected[ITEM].length = 0;
        }
        else {
            selecting[ITEM] = selectedItems;
        }
        this.data.selecting = this.onSelecting(selecting, this.api.mergeDeep({}, this.data.lastSelected));
        let multi = this.state.multi();
        multi = this.updateCells(multi);
        multi = this.updateItems(multi);
        multi.done();
    }
    selectItemsIndividually() {
        this.data.isSelecting = false;
        this.data.selectionAreaLocal = this.getSelectionAreaLocal();
        this.data.currentPosition = this.pointerData.currentPosition;
        this.data.initialPosition = this.pointerData.initialPosition;
        if (!this.canSelect())
            return;
        const item = this.merge({}, this.pointerData.targetData);
        let { selected, automaticallySelected } = this.getSelectedItem(item);
        if (selected.length > 1 && !this.data.multipleSelection) {
            selected = [item.id];
            automaticallySelected = [];
        }
        if (this.isMulti()) {
            if (item.selected) {
                this.data.selected[ITEM] = selected.filter((itemId) => itemId !== item.id && !automaticallySelected.includes(itemId));
            }
            else {
                this.data.selected[ITEM] = selected;
            }
        }
        else {
            this.data.selected[ITEM] = selected;
            this.data.selected[CELL].length = 0;
        }
        this.data.automaticallySelected[ITEM] = automaticallySelected;
        this.data.selected = this.onSelected(this.api.mergeDeep({}, this.data.selected), this.api.mergeDeep({}, this.data.lastSelected));
        let multi = this.state.multi();
        multi = this.updateCells(multi);
        multi = this.updateItems(multi);
        multi.done();
    }
    removeMultiUnselected(type) {
        const elementsToRemove = this.data.selected[type].filter((elementId) => this.data.selecting[type].includes(elementId));
        const allElements = [...this.data.selected[type], ...this.data.selecting[type]];
        return Array.from(new Set(allElements.filter((elementId) => !elementsToRemove.includes(elementId))));
    }
    finishSelection() {
        let selected;
        if (this.isMulti()) {
            // we must remove selected elements when they are selected again (present in selecting)
            selected = {
                [CELL]: this.removeMultiUnselected(CELL),
                [ITEM]: this.removeMultiUnselected(ITEM),
            };
        }
        else {
            selected = {
                [CELL]: [...this.data.selecting[CELL]],
                [ITEM]: [...this.data.selecting[ITEM]],
            };
        }
        this.data.selected = this.onSelected(selected, this.api.mergeDeep({}, this.data.lastSelected));
        this.data.lastSelected = this.api.mergeDeep({}, this.data.selected);
        this.data.selecting[CELL].length = 0;
        this.data.selecting[ITEM].length = 0;
        let multi = this.state.multi();
        multi = this.updateItems(multi);
        multi = this.updateCells(multi);
        multi.done();
    }
    onPointerData() {
        if (this.pointerData.isMoving && this.pointerData.targetType === CELL && this.data.rectangularSelection) {
            this.selectMultipleCellsAndItems();
        }
        else if (this.pointerData.isMoving && this.pointerData.targetType === CELL && !this.data.rectangularSelection) {
            this.deselectItems();
        }
        else if (this.pointerData.isMoving && this.pointerData.targetType === ITEM) {
            this.selectItemsIndividually();
        }
        else if (!this.pointerData.isMoving) {
            if (this.data.isSelecting)
                this.finishSelection();
            this.data.isSelecting = false;
        }
        if (this.pointerData.isMoving && this.pointerData.targetType !== CELL && this.pointerData.targetType !== ITEM) {
            this.deselectItems();
        }
        this.data.events = this.pointerData.events;
        this.data.pointerState = this.pointerData.pointerState;
        this.data.targetType = this.pointerData.targetType;
        this.data.targetData = this.pointerData.targetData;
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
    updateCellSelectionClassName(element, cell) {
        if (cell.selected) {
            element.classList.add(this.data.selectedClassName);
            element.classList.remove(this.data.selectingClassName);
        }
        else {
            element.classList.remove(this.data.selectedClassName);
        }
        if (cell.selecting) {
            element.classList.add(this.data.selectingClassName);
            element.classList.remove(this.data.selectedClassName);
        }
        else {
            element.classList.remove(this.data.selectingClassName);
        }
    }
    selectedCellAction(element, data) {
        this.updateCellSelectionClassName(element, data);
        return {
            update: this.updateCellSelectionClassName,
            destroy: this.updateCellSelectionClassName,
        };
    }
    onCellCreate(cell) {
        cell.selected = !!this.data.selected[CELL].find((selectedCellId) => selectedCellId === cell.id);
        cell.selecting = !!this.data.selecting[CELL].find((selectedCellId) => selectedCellId === cell.id);
        return cell;
    }
}
function Plugin$3(options = {}) {
    options = prepareOptions$1(options);
    return function initialize(vidoInstance) {
        const currentOptions = vidoInstance.state.get(pluginPath$3);
        if (currentOptions) {
            options = mergeDeep({}, options, currentOptions);
        }
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
const defaultOptions$1 = {
    enabled: true,
    bodyClassName: 'gstc-scrolling',
};
function Plugin$4(options = defaultOptions$1) {
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
        pointerUp( /*ev: PointerEvent*/) {
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
        const pluginPath = 'config.plugin.CalendarScroll';
        const currentOptions = vidoInstance.state.get(pluginPath);
        if (currentOptions) {
            options = mergeDeep({}, options, currentOptions);
        }
        state.update(pluginPath, options);
        state.subscribe('config.plugin.CalendarScroll.enabled', (value) => (enabled = value));
        state.update('config.actions.chart-calendar', (chartActions) => {
            chartActions.push(ChartAction);
            return chartActions;
        });
        return function destroy() {
            state.update('config.actions.chart-calendar', (chartActions) => {
                return chartActions.filter((action) => action !== ChartAction);
            });
        };
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
        const subs = [];
        const pluginPath = 'config.plugin.HighlightWeekends';
        api = vidoInstance.api;
        className = options.className || api.getClass('chart-timeline-grid-row-cell') + '--weekend';
        const currentOptions = vidoInstance.state.get(pluginPath);
        if (currentOptions) {
            options = mergeDeep({}, options, currentOptions);
        }
        subs.push(vidoInstance.state.subscribe('$data.chart.time.format.period', (period) => (enabled = period === 'day')));
        vidoInstance.state.update('config.actions.chart-timeline-grid-row-cell', (actions) => {
            actions.push(WeekendHighlightAction);
            return actions;
        });
        return function onDestroy() {
            subs.forEach((unsub) => unsub());
            vidoInstance.state.update('config.actions.chart-timeline-grid-row-cell', (actions) => {
                return actions.filter((action) => action !== WeekendHighlightAction);
            });
        };
    };
}

var HighlightWeekends = /*#__PURE__*/Object.freeze({
  __proto__: null,
  Plugin: Plugin$5
});

var plugins = { TimelinePointer: TimelinePointer$1, ItemMovement: ItemMovement$1, ItemResizing: ItemResizing$1, Selection, CalendarScroll, HighlightWeekends };

export default plugins;
//# sourceMappingURL=plugins.esm.js.map
