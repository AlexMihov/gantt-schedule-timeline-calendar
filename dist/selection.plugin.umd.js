(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = global || self, factory(global.Selection = {}));
}(this, (function (exports) { 'use strict';

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

  /**
   * Selection plugin
   *
   * @copyright Rafal Pospiech <https://neuronet.io>
   * @author    Rafal Pospiech <neuronet.io@gmail.com>
   * @package   gantt-schedule-timeline-calendar
   * @license   AGPL-3.0 (https://github.com/neuronetio/gantt-schedule-timeline-calendar/blob/master/LICENSE)
   * @link      https://github.com/neuronetio/gantt-schedule-timeline-calendar
   */
  function prepareOptions(options) {
      const defaultOptions = {
          enabled: true,
          cells: true,
          items: true,
          rows: false,
          showOverlay: true,
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
  const pluginPath = 'config.plugin.Selection';
  function generateEmptyData(options) {
      return Object.assign({ enabled: true, showOverlay: true, isSelecting: false, pointerState: 'up', selectKey: '', multiKey: 'shift', multipleSelection: true, targetType: '', initialPosition: { x: 0, y: 0 }, currentPosition: { x: 0, y: 0 }, selectionAreaLocal: { x: 0, y: 0, width: 0, height: 0 }, selectionAreaGlobal: { x: 0, y: 0, width: 0, height: 0 }, selecting: {
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
          this.unsub = [];
          this.vido = vido;
          this.state = vido.state;
          this.api = vido.api;
          this.state.update(pluginPath, generateEmptyData(options));
          this.data = generateEmptyData(options);
          this.wrapperClassName = this.api.getClass('chart-selection');
          this.wrapperStyleMap = new vido.StyleMap({ display: 'none' });
          this.html = vido.html;
          this.wrapper = this.wrapper.bind(this);
          this.setWrapper();
          this.unsub.push(this.state.subscribe('config.plugin.TimelinePointer', (timelinePointerData) => {
              this.poitnerData = timelinePointerData;
              this.onPointerData();
          }));
          this.updateData();
          this.unsub.push(this.state.subscribe(pluginPath, (value) => {
              this.data = value;
          }));
          // watch and update items that are inside selection
          this.unsub.push(this.state.subscribe('config.chart.items', (items) => {
              this.data.selected[ITEM] = this.data.selected[ITEM].map((item) => items[item.id]);
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
          this.unsub.forEach((unsub) => unsub());
      }
      updateData() {
          this.state.update(pluginPath, Object.assign({}, this.data));
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
                      this.collectLinkedItems(linkedItem, current);
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
              selected = this.data.selected[ITEM].slice();
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
          for (const item of visibleItems) {
              const itemData = item.$data;
              if (this.isItemVerticallyInsideArea(itemData, areaLocal) &&
                  this.isItemHorizontallyInsideArea(itemData, areaLocal)) {
                  if (!selected.find((selectedItem) => selectedItem.id === item.id))
                      selected.push(item);
                  const linked = this.collectLinkedItems(item, [item]);
                  for (const linkedItem of linked) {
                      if (!selected.find((selectedItem) => selectedItem.id === linkedItem.id)) {
                          selected.push(linkedItem);
                          automaticallySelected.push(linkedItem);
                      }
                  }
              }
          }
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
          const item = this.poitnerData.targetData;
          const { selected, automaticallySelected } = this.getSelected(item);
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
          if (this.poitnerData.isMoving && this.poitnerData.targetType === CELL) {
              this.selectMultipleCellsAndItems();
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
          this.updateData();
      }
      wrapper(input, props) {
          if (!this.oldWrapper)
              return input;
          const oldContent = this.oldWrapper(input, props);
          let shouldDetach = true;
          if (this.canSelect() && this.data.isSelecting && this.data.showOverlay && this.data.multipleSelection) {
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
  function Plugin(options = {}) {
      options = prepareOptions(options);
      return function initialize(vidoInstance) {
          const selectionPlugin = new SelectionPlugin(vidoInstance, options);
          return function destroy() {
              selectionPlugin.destroy();
          };
      };
  }

  exports.Plugin = Plugin;

  Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=selection.plugin.umd.js.map
