import GSTC from '../../dist/gstc.esm.js';
import { Plugin as TimelinePointer } from '../../dist/timeline-pointer.plugin.esm.js';
import { Plugin as Selection } from '../../dist/selection.plugin.esm.js';
import { Plugin as ItemMovement } from '../../dist/item-movement.plugin.esm.js';
import { Plugin as ItemResizing } from '../../dist/item-resizing.plugin.esm.js';
import { Plugin as CalendarScroll } from '../../dist/calendar-scroll.plugin.esm.js';
import { Plugin as HighlightWeekends } from '../../dist/highlight-weekends.plugin.esm.js';

const iterations = 100;

const rows = {};
for (let i = 0; i < iterations; i++) {
  const withParent = i > 0 && i % 2 === 0;
  const id = `row-${i}`;
  rows[id] = {
    id,
    label: `Row ${id}`,
    parentId: withParent ? `row-${i - 1}` : undefined,
    expanded: false,
  };
}

const startDate = GSTC.api.date().subtract(5, 'month').valueOf();

const items = {};
for (let i = 0; i < iterations; i++) {
  let rowId = `row-${i}`;
  let id = i.toString();
  let startDayjs = GSTC.api
    .date(startDate)
    .startOf('day')
    .add(Math.floor(Math.random() * 365 * 2), 'days');
  items[id] = {
    id,
    label: 'item id ' + id,
    time: {
      start: startDayjs.valueOf(),
      end: startDayjs
        .clone()
        .add(Math.floor(Math.random() * 20) + 4, 'days')
        .endOf('day')
        .valueOf(),
    },
    rowId,
  };
}
items['0'].linkedWith = ['1'];
items['1'].time = { ...items['0'].time };

items['3'].dependant = ['5'];
items['5'].time.start = items['3'].time.end;
items['5'].time.end = GSTC.api.date(items['5'].time.start).add(2, 'day').valueOf();
items['5'].dependant = ['7'];
items['7'].time.start = items['5'].time.end;
items['7'].time.end = GSTC.api.date(items['7'].time.start).add(2, 'day').valueOf();

const columns = {
  data: {
    id: {
      id: 'id',
      data: 'id',
      width: 80,
      header: {
        content: 'ID',
      },
    },
    label: {
      id: 'label',
      data: 'label',
      expander: true,
      isHTML: false,
      width: 230,
      header: {
        content: 'Label',
      },
    },
  },
};

const config = {
  //debug: true,
  plugins: [HighlightWeekends(), TimelinePointer(), Selection(), /*ItemMovement(),*/ ItemResizing(), CalendarScroll()],
  list: {
    rows,
    columns,
  },
  chart: {
    items,
  },
  usageStatistics: false,
};

var state = GSTC.api.stateFromConfig(config);
const element = document.getElementById('app');

element.addEventListener('gstc-loaded', () => {
  gstc.api.scrollToTime(gstc.api.time.date().valueOf()); // eslint-disable-line
});

var gstc = GSTC({
  element,
  state,
});

//@ts-ignore
window.state = state;
//@ts-ignore
window.gstc = gstc;

document.getElementById('percent').addEventListener('input', (ev) => {
  gstc.state.update('config.list.columns.percent', +ev.target.value);
});
document.getElementById('zoom').addEventListener('input', (ev) => {
  gstc.state.update('config.chart.time.zoom', +ev.target.value);
  const period = gstc.state.get('config.chart.time');
  console.log(`current period: `, period); // eslint-disable-line
});

function selectCells() {
  const api = gstc.api;
  const allCells = api.getGridCells();
  api.plugins.selection.selectCells([allCells[0].id, allCells[1].id]);
  api.plugins.selection.selectItems(['2']);
  console.log(api.plugins.selection.getSelection());
}
document.getElementById('select-cells').addEventListener('click', selectCells);
