import { Time } from './time';
import State from 'deep-state-observer';
import DeepState from 'deep-state-observer';
import dayjs from 'dayjs';
import { Config, DataChartTime, ScrollTypeHorizontal, Row, Item, Vido, Items, ScrollTypeVertical, Rows } from '../gstc';
import { generateSlots } from './slots';
import { lithtml } from '@neuronet.io/vido/src/vido';
export declare function getClass(name: string, appendix?: string): string;
export declare function getId(name: string, id: string): string;
export declare function prepareState(userConfig: Config): {
    config: any;
};
export declare function stateFromConfig(userConfig: Config): State;
export declare function wasmStateFromConfig(userConfig: Config, wasmFile?: string): Promise<any>;
export declare const publicApi: {
    name: string;
    stateFromConfig: typeof stateFromConfig;
    wasmStateFromConfig: typeof wasmStateFromConfig;
    merge: typeof import("@neuronet.io/vido/src/helpers").mergeDeep;
    lithtml: typeof lithtml;
    date(time: any): dayjs.Dayjs;
    setPeriod(period: dayjs.OpUnitType): number;
    dayjs: typeof dayjs;
};
export interface WheelResult {
    x: number;
    y: number;
    z: number;
    event: MouseWheelEvent;
}
export interface IconsCache {
    [key: string]: string;
}
export declare type Unsubscribes = (() => void)[];
export declare class Api {
    name: string;
    debug: boolean;
    state: DeepState;
    time: Time;
    vido: Vido;
    private iconsCache;
    private unsubscribes;
    constructor(state: DeepState);
    setVido(Vido: Vido): void;
    log(...args: any[]): void;
    generateSlots: typeof generateSlots;
    mergeDeep: typeof import("@neuronet.io/vido/src/helpers").mergeDeep;
    getClass: typeof getClass;
    getId: typeof getId;
    allActions: any[];
    getActions(name: string): any;
    isItemInViewport(item: Item, leftGlobal: number, rightGlobal: number): boolean;
    getAllLinkedItemsIds(item: Item, items: Items, allLinked?: string[]): string[];
    getRow(rowId: string): Row;
    getRows(rowsId: string[]): Row[];
    getAllRows(): Rows;
    getItem(itemId: string): Item;
    getItems(itemsId: string[]): Item[];
    getAllItems(): Items;
    prepareLinkedItems(item: Item, items: Items): void;
    prepareItems(items: Items): Items;
    fillEmptyRowValues(rows: Rows): Rows;
    itemsOnTheSameLevel(item1: Item, item2: Item): boolean;
    itemsOverlaps(item1: Item, item2: Item): boolean;
    itemOverlapsWithOthers(item: Item, items: Item[]): Item;
    fixOverlappedItems(rowItems: Item[]): void;
    recalculateRowHeight(row: Row, fixOverlapped?: boolean): number;
    recalculateRowsHeightsAndFixOverlappingItems(rowsId: string[]): number;
    recalculateRowsPercents(rowsId: string[], verticalAreaHeight: number): void;
    generateParents(rows: Rows | Items, parentName?: string): {};
    fastTree(rowParents: any, node: any, parents?: any[]): any;
    makeTreeMap(rows: Rows, items: Items): any;
    getRowsWithParentsExpanded(rows: Rows): any[];
    getVisibleRows(rowsWithParentsExpanded: string[]): string[];
    normalizeMouseWheelEvent(event: MouseWheelEvent): WheelResult;
    scrollToTime(toTime: number, centered?: boolean, time?: DataChartTime): number;
    setScrollLeft(dataIndex: number | undefined, time?: DataChartTime, multi?: any, recalculateTimesLastReason?: string): any;
    getScrollLeft(): ScrollTypeHorizontal;
    setScrollTop(dataIndex: number | undefined, offset?: number): void;
    getScrollTop(): ScrollTypeVertical;
    getSVGIconSrc(svg: any): string;
    destroy(): void;
}
//# sourceMappingURL=api.d.ts.map