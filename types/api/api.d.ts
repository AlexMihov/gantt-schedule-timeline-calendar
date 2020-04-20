import { Time } from './time';
import DeepState from 'deep-state-observer';
import dayjs from 'dayjs';
import { Config, DataChartTime, ScrollTypeHorizontal, Row, Item, Vido, Items, ScrollTypeVertical, Rows } from '../gstc';
export declare function getClass(name: string): string;
export declare function prepareState(userConfig: Config): {
    config: any;
};
export declare function stateFromConfig(userConfig: Config): any;
export declare function stateFromConfigExperimental(userConfig: Config): Promise<any>;
export declare const publicApi: {
    name: string;
    stateFromConfig: typeof stateFromConfig;
    stateFromConfigExperimental: typeof stateFromConfigExperimental;
    merge: typeof import("@neuronet.io/vido/helpers").mergeDeep;
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
    mergeDeep: typeof import("@neuronet.io/vido/helpers").mergeDeep;
    getClass: typeof getClass;
    allActions: any[];
    getActions(name: string): any;
    isItemInViewport(item: Item, leftGlobal: number, rightGlobal: number): boolean;
    prepareItems(items: Items): Items;
    fillEmptyRowValues(rows: Rows): Rows;
    itemsOnTheSameLevel(item1: Item, item2: Item): boolean;
    itemsOverlaps(item1: Item, item2: Item): boolean;
    itemOverlapsWithOthers(item: Item, items: Item[]): boolean;
    fixOverlappedItems(rowItems: Item[]): void;
    recalculateRowHeight(row: Row): number;
    recalculateRowsHeightsAndFixOverlappingItems(rows: Row[]): number;
    recalculateRowsPercents(rows: Row[], verticalAreaHeight: number): Row[];
    generateParents(rows: any, parentName?: string): {};
    fastTree(rowParents: any, node: any, parents?: any[]): any;
    makeTreeMap(rows: Rows, items: Items): any;
    getRowsWithParentsExpanded(rows: Rows): any[];
    getVisibleRows(rowsWithParentsExpanded: Row[]): Row[];
    normalizeMouseWheelEvent(event: MouseWheelEvent): WheelResult;
    scrollToTime(toTime: number, centered?: boolean, time?: DataChartTime): number;
    setScrollLeft(dataIndex: number | undefined, time?: DataChartTime, multi?: any, recalculateTimesLastReason?: string): any;
    getScrollLeft(): ScrollTypeHorizontal;
    setScrollTop(dataIndex: number | undefined): void;
    getScrollTop(): ScrollTypeVertical;
    getSVGIconSrc(svg: any): string;
    destroy(): void;
}
//# sourceMappingURL=api.d.ts.map