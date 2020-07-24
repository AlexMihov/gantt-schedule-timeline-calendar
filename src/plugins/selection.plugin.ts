/**
 * Selection plugin
 *
 * @copyright Rafal Pospiech <https://neuronet.io>
 * @author    Rafal Pospiech <neuronet.io@gmail.com>
 * @package   gantt-schedule-timeline-calendar
 * @license   AGPL-3.0 (https://github.com/neuronetio/gantt-schedule-timeline-calendar/blob/master/LICENSE)
 * @link      https://github.com/neuronetio/gantt-schedule-timeline-calendar
 */

import {
  PluginData as TimelinePointerPluginData,
  ITEM,
  ITEM_TYPE,
  CELL,
  CELL_TYPE,
  Point,
  PointerState,
  SELECTION_TYPE,
} from './timeline-pointer.plugin';

import { Item, GridCell, Items, Vido, htmlResult, Wrapper, ItemData, GridCells } from '../gstc';
import DeepState from 'deep-state-observer';
import { Api } from '../api/api';
import { StyleMap, lithtml } from '@neuronet.io/vido/src/vido';
import { mergeDeep } from '@neuronet.io/vido/src/helpers';

export type ModKey = 'shift' | 'ctrl' | 'alt' | '';

export interface SelectionItems {
  [key: string]: Item[];
}

export interface SelectState {
  selecting?: SelectionItems;
  selected?: SelectionItems;
}

export interface Options {
  enabled?: boolean;
  cells?: boolean;
  items?: boolean;
  rows?: boolean;
  showOverlay?: boolean;
  rectangularSelection?: boolean;
  multipleSelection?: boolean;
  selectKey?: ModKey;
  multiKey?: ModKey;
  selectedClassName?: string;
  selectingClassName?: string;
  onSelecting?: (selecting: EventSelection, last: EventSelection) => EventSelection;
  onSelected?: (selected: EventSelection, last: EventSelection) => EventSelection;
}

function prepareOptions(options: Options) {
  const defaultOptions: Options = {
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
  options = { ...defaultOptions, ...options } as Options;
  return options;
}

const pluginPath = 'config.plugin.Selection';

export interface Area {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Selection {
  [CELL]: string[];
  [ITEM]: string[];
}

export type GridCellOrId = GridCell | string;
export type ItemOrId = Item | string;

export interface EventSelection {
  [CELL]: GridCellOrId[];
  [ITEM]: ItemOrId[];
}

export interface SelectedCell {
  rowId: string;
  cellId: string;
}

export interface PointerEvents {
  down: PointerEvent | null;
  move: PointerEvent | null;
  up: PointerEvent | null;
}

export interface PluginData extends Options {
  enabled: boolean;
  isSelecting: boolean;
  showOverlay: boolean;
  pointerState: PointerState;
  initialPosition: Point;
  currentPosition: Point;
  selectionAreaLocal: Area;
  selectionAreaGlobal: Area;
  selected: Selection;
  lastSelected: Selection;
  selecting: Selection;
  automaticallySelected: Selection;
  events: PointerEvents;
  targetType: ITEM_TYPE | CELL_TYPE | '';
  targetData: any;
}

function generateEmptyData(options: Options): PluginData {
  return {
    enabled: true,
    showOverlay: true,
    isSelecting: false,
    pointerState: 'up',
    selectKey: '',
    multiKey: 'shift',
    multipleSelection: true,
    targetType: '',
    targetData: null,
    initialPosition: { x: 0, y: 0 },
    currentPosition: { x: 0, y: 0 },
    selectionAreaLocal: { x: 0, y: 0, width: 0, height: 0 },
    selectionAreaGlobal: { x: 0, y: 0, width: 0, height: 0 },
    selecting: {
      [ITEM]: [],
      [CELL]: [],
    },
    selected: {
      [ITEM]: [],
      [CELL]: [],
    },
    lastSelected: {
      [ITEM]: [],
      [CELL]: [],
    },
    automaticallySelected: {
      [ITEM]: [],
      [CELL]: [],
    },
    events: {
      down: null,
      move: null,
      up: null,
    },
    ...options,
  };
}

class SelectionPlugin {
  private data: PluginData;
  private pointerData: TimelinePointerPluginData;
  private vido: Vido;
  private state: DeepState;
  private api: Api;
  private onDestroy = [];
  private oldWrapper: Wrapper;
  private html: typeof lithtml.html;
  private wrapperClassName: string;
  private wrapperStyleMap: StyleMap;
  private merge: (target: object, source: object) => object;

  constructor(vido: Vido, options: Options) {
    this.vido = vido;
    this.state = vido.state;
    this.api = vido.api;
    this.merge = this.state.get('config.merge');
    this.state.update(pluginPath, generateEmptyData(options));
    this.data = generateEmptyData(options);
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
      if (!onCreate.includes(this.onCellCreate)) onCreate.push(this.onCellCreate);
      return onCreate;
    });
    this.onDestroy.push(
      this.state.subscribe('config.plugin.TimelinePointer', (timelinePointerData) => {
        this.pointerData = timelinePointerData;
        this.onPointerData();
      })
    );
    this.updateData();
    this.onDestroy.push(
      this.state.subscribe(pluginPath, (value) => {
        this.data = value;
      })
    );
    this.updateCellSelectionClassName = this.updateCellSelectionClassName.bind(this);
    this.selectedCellAction = this.selectedCellAction.bind(this);
    this.state.update('config.actions.chart-timeline-grid-row-cell', (actions) => {
      if (!actions.includes(this.selectedCellAction)) actions.push(this.selectedCellAction);
      return actions;
    });
    // watch and update items/cells that are inside selection
    // remove ones that no longer exist
    // for cells we cannot do that because cells are created dynamically
    this.onDestroy.push(
      this.state.subscribe(
        'config.chart.items',
        (items: Items) => {
          this.data.selected[ITEM] = this.data.selected[ITEM].filter((itemId) => !!items[itemId]);
          this.data.selecting[ITEM] = this.data.selecting[ITEM].filter((itemId) => !!items[itemId]);
        },
        {
          ignore: ['$data.chart.items.*.detached', 'config.chart.items.*.selected', 'config.chart.items.*.selecting'],
        }
      )
    );
  }

  private setWrapper() {
    this.state.update('config.wrappers.ChartTimelineItems', (oldWrapper: Wrapper) => {
      if (!this.oldWrapper) this.oldWrapper = oldWrapper;
      return this.wrapper;
    });
  }

  public destroy() {
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

  private updateData() {
    this.state.update(pluginPath, { ...this.data });
    this.vido.update(); // draw selection area overlay
  }

  private apiSetSelection(selection: Selection) {
    this.data.selected = this.api.mergeDeep({}, selection);
    let multi = this.state.multi();
    multi = this.updateCells(multi);
    multi = this.updateItems(multi);
    multi.done();
    this.updateData();
  }

  private apiSelectCells(cellsId: string[]) {
    this.data.selected[CELL] = [...cellsId];
    let multi = this.state.multi();
    multi = this.updateCells(multi);
    multi.done();
    this.updateData();
  }

  private apiSelectItems(itemsId: string[]) {
    this.data.selected[ITEM] = [...itemsId];
    let multi = this.state.multi();
    multi = this.updateItems(multi);
    multi.done();
    this.updateData();
  }

  private apiGetSelection() {
    return {
      selecting: this.getSelectionWithData(this.data.selecting),
      selected: this.getSelectionWithData(this.data.selected),
    };
  }

  private apiGetSelecting() {
    return this.getSelectionWithData(this.data.selecting);
  }

  private apiGetSelected() {
    return this.getSelectionWithData(this.data.selected);
  }

  private modKeyPressed(modKey: ModKey, ev: PointerEvent): boolean {
    switch (modKey) {
      case 'shift':
        return ev.shiftKey;
      case 'alt':
        return ev.altKey;
      case 'ctrl':
        return ev.ctrlKey;
    }
  }

  private canSelect(): boolean {
    let result = this.data.enabled;
    const downEvent = this.pointerData.events.down;
    if (downEvent && this.data.selectKey) result = result && this.modKeyPressed(this.data.selectKey, downEvent);
    return result;
  }

  private getSelectionAreaLocal(): Area {
    const area = { x: 0, y: 0, width: 0, height: 0 };
    const initial = { ...this.pointerData.initialPosition };
    const current = { ...this.pointerData.currentPosition };
    const width = current.x - initial.x;
    const height = current.y - initial.y;
    if (width >= 0) {
      area.x = initial.x;
      area.width = width;
    } else {
      area.x = current.x;
      area.width = Math.abs(width);
    }
    if (height >= 0) {
      area.y = initial.y;
      area.height = height;
    } else {
      area.y = current.y;
      area.height = Math.abs(height);
    }
    return area;
  }

  private translateAreaLocalToGlobal(localArea: Area): Area {
    const leftPx: number = this.state.get('$data.chart.time.leftPx');
    const topPx: number = this.state.get('config.scroll.vertical.posPx');
    return { ...localArea, x: localArea.x + leftPx, y: localArea.y + topPx };
  }

  private collectLinkedItems(item: Item, current: string[] = []): string[] {
    if (item.linkedWith && item.linkedWith.length) {
      const items: Items = this.api.getAllItems();
      for (const linkedItemId of item.linkedWith) {
        const linkedItem: Item = items[linkedItemId];
        if (!current.includes(linkedItem.id)) {
          current.push(linkedItem.id);
          // we don't need to go further because linkedWith property already contains all we need
        }
      }
    }
    return current;
  }

  private getSelectedItem(item: Item): { selected: string[]; automaticallySelected: string[] } {
    let selected: string[];
    let automaticallySelected: string[] = this.data.automaticallySelected[ITEM].slice();
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
      } else {
        automaticallySelected = this.data.automaticallySelected[ITEM];
      }
    } else {
      if (this.isMulti()) {
        selected = Array.from(new Set([...this.data.selected[ITEM], ...linked]));
      } else {
        selected = linked;
      }
      automaticallySelected = linked.filter((currentItemId) => currentItemId !== item.id);
    }
    selected = selected.map((itemId) => {
      item = this.api.getItem(itemId);
      return itemId;
    });
    return { selected, automaticallySelected };
  }

  private isItemVerticallyInsideArea(itemData: ItemData, area: Area): boolean {
    if (!area.width || !area.height) return false;
    const areaBottom = area.y + area.height;
    const itemTop = itemData.position.viewTop;
    const itemBottom = itemTop + itemData.actualHeight;
    return (
      (itemTop >= area.y && itemTop <= areaBottom) ||
      (itemBottom >= area.y && itemBottom <= areaBottom) ||
      (itemTop >= area.y && itemBottom <= areaBottom) ||
      (itemTop <= area.y && itemBottom >= areaBottom)
    );
  }

  private isItemHorizontallyInsideArea(itemData: ItemData, area: Area): boolean {
    if (!area.width || !area.height) return false;
    const areaRight = area.x + area.width;
    return (
      (itemData.position.actualLeft >= area.x && itemData.position.actualLeft <= areaRight) ||
      (itemData.position.actualRight >= area.x && itemData.position.actualRight <= areaRight) ||
      (itemData.position.actualLeft <= area.x && itemData.position.actualRight >= areaRight) ||
      (itemData.position.actualLeft >= area.x && itemData.position.actualRight <= areaRight)
    );
  }

  private isMulti(): boolean {
    const move = this.pointerData.events.move;
    return move && this.data.multiKey && this.modKeyPressed(this.data.multiKey, move);
  }

  private getItemsUnderSelectionArea(
    areaLocal: Area
  ): { selectedItems: string[]; automaticallySelectedItems: string[] } {
    const visibleItemsId: string[] = this.state.get('$data.chart.visibleItems');
    const visibleItems: Item[] = this.api.getItems(visibleItemsId);
    let selectedItems = [];
    const automaticallySelectedItems = [];
    for (let item of visibleItems) {
      item = this.merge({}, item) as Item;
      const itemData = this.api.getItemData(item.id);
      if (
        this.isItemVerticallyInsideArea(itemData, areaLocal) &&
        this.isItemHorizontallyInsideArea(itemData, areaLocal)
      ) {
        if (!selectedItems.find((selectedItemId) => selectedItemId === item.id)) selectedItems.push(item.id);
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

  private isCellVerticallyInsideArea(cell: GridCell, area: Area): boolean {
    if (!area.width || !area.height) return false;
    const areaBottom = area.y + area.height;
    const top = cell.top;
    const bottom = top + cell.row.$data.actualHeight;
    return (
      (top >= area.y && top <= areaBottom) ||
      (bottom >= area.y && bottom <= areaBottom) ||
      (top >= area.y && bottom <= areaBottom) ||
      (top <= area.y && bottom >= areaBottom)
    );
  }

  private isCellHorizontallyInsideArea(cell: GridCell, area: Area): boolean {
    if (!area.width || !area.height) return false;
    const areaRight = area.x + area.width;
    const left = cell.time.currentView.leftPx;
    const right = cell.time.currentView.rightPx;
    return (
      (left >= area.x && left <= areaRight) ||
      (right >= area.x && right <= areaRight) ||
      (left <= area.x && right >= areaRight) ||
      (left >= area.x && right <= areaRight)
    );
  }

  private getCellsUnderSelectionArea(areaLocal: Area): { selectedCells: string[] } {
    const cells: GridCells = this.state.get('$data.chart.grid.cells');
    const selectedCells = [];
    for (const cellId in cells) {
      const cell = cells[cellId];
      if (this.isCellVerticallyInsideArea(cell, areaLocal) && this.isCellHorizontallyInsideArea(cell, areaLocal)) {
        if (!selectedCells.find((selectedCell: string) => selectedCell === cell.id)) selectedCells.push(cell.id);
      }
    }
    return { selectedCells };
  }

  private updateItems(multi) {
    const allItems: Item[] = this.api.getItems();
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

  private updateCells(multi) {
    const allCells: GridCell[] = this.api.getGridCells();
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
    multi.update('$data.chart.grid.cells', (cells: GridCells) => {
      for (const cellId in cells) {
        const cell = cells[cellId];
        cell.selected = this.data.selected[CELL].includes(cell.id);
        cell.selecting = this.data.selecting[CELL].includes(cell.id);
      }
      return cells;
    });
    return multi;
  }

  private deselectItems() {
    this.data.selected[ITEM].length = 0;
    this.data.selecting[ITEM].length = 0;
    let multi = this.state.multi();
    multi = this.updateItems(multi);
    multi.done();
  }

  private deselectCells() {
    this.data.selecting[CELL].length = 0;
    this.data.selected[CELL].length = 0;
    let multi = this.state.multi();
    multi = this.updateCells(multi);
    multi.done();
  }

  private getSelectionWithData(selection: Selection): EventSelection {
    const items = this.state.get('config.chart.items');
    const cells = this.state.get('$data.chart.grid.cells');
    return {
      [CELL]: selection[CELL].map((cellId) => (cells[cellId] ? cells[cellId] : cellId)),
      [ITEM]: selection[ITEM].map((itemId) => (items[itemId] ? items[itemId] : itemId)),
    };
  }

  // send cell and item data to event - not just id
  private onSelecting(selecting: Selection, last: Selection): Selection {
    const selectingWithData = this.getSelectionWithData(selecting);
    const lastWithData = this.getSelectionWithData(last);
    const result = this.data.onSelecting(selectingWithData, lastWithData);
    return {
      [CELL]: result[CELL].map((cell) => (typeof cell !== 'string' ? cell.id : cell)),
      [ITEM]: result[ITEM].map((item) => (typeof item !== 'string' ? item.id : item)),
    };
  }

  // send cell and item data to event - not just id
  private onSelected(selected: Selection, last: Selection): Selection {
    const selectedWithData = this.getSelectionWithData(selected);
    const lastWithData = this.getSelectionWithData(last);
    const result = this.data.onSelected(selectedWithData, lastWithData);
    return {
      [CELL]: result[CELL].map((cell) => (typeof cell !== 'string' ? cell.id : cell)),
      [ITEM]: result[ITEM].map((item) => (typeof item !== 'string' ? item.id : item)),
    };
  }

  private selectMultipleCellsAndItems() {
    if (!this.canSelect()) return;
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
      if (!isMulti) this.data.selected[CELL].length = 0;
    } else {
      selecting[CELL] = selectedCells;
    }
    const { selectedItems, automaticallySelectedItems } = this.getItemsUnderSelectionArea(this.data.selectionAreaLocal);
    this.data.automaticallySelected[ITEM] = automaticallySelectedItems;
    if (selectedItems.length === 0) {
      selecting[ITEM].length = 0;
      if (!isMulti) this.data.selected[ITEM].length = 0;
    } else {
      selecting[ITEM] = selectedItems;
    }

    this.data.selecting = this.onSelecting(selecting, this.api.mergeDeep({}, this.data.lastSelected));

    let multi = this.state.multi();
    multi = this.updateCells(multi);
    multi = this.updateItems(multi);
    multi.done();
  }

  private selectItemsIndividually() {
    this.data.isSelecting = false;
    this.data.selectionAreaLocal = this.getSelectionAreaLocal();
    this.data.currentPosition = this.pointerData.currentPosition;
    this.data.initialPosition = this.pointerData.initialPosition;
    if (!this.canSelect()) return;
    const item: Item = this.merge({}, this.pointerData.targetData) as Item;
    let { selected, automaticallySelected } = this.getSelectedItem(item);
    if (selected.length > 1 && !this.data.multipleSelection) {
      selected = [item.id];
      automaticallySelected = [];
    }
    if (this.isMulti()) {
      if (item.selected) {
        this.data.selected[ITEM] = selected.filter(
          (itemId) => itemId !== item.id && !automaticallySelected.includes(itemId)
        );
      } else {
        this.data.selected[ITEM] = selected;
      }
    } else {
      this.data.selected[ITEM] = selected;
      this.data.selected[CELL].length = 0;
    }
    this.data.automaticallySelected[ITEM] = automaticallySelected;
    this.data.selected = this.onSelected(
      this.api.mergeDeep({}, this.data.selected),
      this.api.mergeDeep({}, this.data.lastSelected)
    );
    let multi = this.state.multi();
    multi = this.updateCells(multi);
    multi = this.updateItems(multi);
    multi.done();
  }

  private removeMultiUnselected(type: SELECTION_TYPE): string[] {
    const elementsToRemove = this.data.selected[type].filter((elementId) =>
      this.data.selecting[type].includes(elementId)
    );
    const allElements = [...this.data.selected[type], ...this.data.selecting[type]];
    return Array.from(new Set(allElements.filter((elementId) => !elementsToRemove.includes(elementId))));
  }

  private finishSelection() {
    let selected;
    if (this.isMulti()) {
      // we must remove selected elements when they are selected again (present in selecting)
      selected = {
        [CELL]: this.removeMultiUnselected(CELL),
        [ITEM]: this.removeMultiUnselected(ITEM),
      };
    } else {
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

  private onPointerData() {
    if (this.pointerData.isMoving && this.pointerData.targetType === CELL && this.data.rectangularSelection) {
      this.selectMultipleCellsAndItems();
    } else if (this.pointerData.isMoving && this.pointerData.targetType === CELL && !this.data.rectangularSelection) {
      this.deselectItems();
    } else if (this.pointerData.isMoving && this.pointerData.targetType === ITEM) {
      this.selectItemsIndividually();
    } else if (!this.pointerData.isMoving) {
      if (this.data.isSelecting) this.finishSelection();
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

  private wrapper(input: htmlResult, props?: any) {
    if (!this.oldWrapper) return input;
    const oldContent = this.oldWrapper(input, props);
    let shouldDetach = true;
    if (
      this.canSelect() &&
      this.data.isSelecting &&
      this.data.showOverlay &&
      this.data.multipleSelection &&
      this.data.rectangularSelection
    ) {
      this.wrapperStyleMap.style.display = 'block';
      this.wrapperStyleMap.style.left = this.data.selectionAreaLocal.x + 'px';
      this.wrapperStyleMap.style.top = this.data.selectionAreaLocal.y + 'px';
      this.wrapperStyleMap.style.width = this.data.selectionAreaLocal.width + 'px';
      this.wrapperStyleMap.style.height = this.data.selectionAreaLocal.height + 'px';
      shouldDetach = false;
    }
    const area = this.html`<div class=${this.wrapperClassName} style=${this.wrapperStyleMap}></div>`;
    return this.html`${oldContent}${shouldDetach ? null : area}`;
  }

  private updateCellSelectionClassName(element: HTMLElement, cell: GridCell) {
    if (cell.selected) {
      element.classList.add(this.data.selectedClassName);
      element.classList.remove(this.data.selectingClassName);
    } else {
      element.classList.remove(this.data.selectedClassName);
    }
    if (cell.selecting) {
      element.classList.add(this.data.selectingClassName);
      element.classList.remove(this.data.selectedClassName);
    } else {
      element.classList.remove(this.data.selectingClassName);
    }
  }

  private selectedCellAction(element: HTMLElement, data: GridCell) {
    this.updateCellSelectionClassName(element, data);
    return {
      update: this.updateCellSelectionClassName,
      destroy: this.updateCellSelectionClassName,
    };
  }

  private onCellCreate(cell: GridCell) {
    cell.selected = !!this.data.selected[CELL].find((selectedCellId) => selectedCellId === cell.id);
    cell.selecting = !!this.data.selecting[CELL].find((selectedCellId) => selectedCellId === cell.id);
    return cell;
  }
}

export function Plugin(options: Options = {}) {
  options = prepareOptions(options);
  return function initialize(vidoInstance: Vido) {
    const currentOptions = vidoInstance.state.get(pluginPath);
    if (currentOptions) {
      options = mergeDeep({}, options, currentOptions);
    }
    const selectionPlugin = new SelectionPlugin(vidoInstance, options);
    return selectionPlugin.destroy;
  };
}
