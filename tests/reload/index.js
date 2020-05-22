import GSTC from '../../dist/gstc.esm.js';

function generateRowsAndItems(iterations) {
  const rows = {};
  for (let i = 0; i < iterations; i++) {
    const withParent = i > 0 && i % 2 === 0;
    const id = i.toString();
    rows[id] = {
      id,
      label: `row id: ${id}`,
      parentId: withParent ? (i - 1).toString() : undefined,
      expanded: false,
    };
  }

  const startDate = GSTC.api.date().subtract(5, 'month').valueOf();

  const items = {};
  for (let i = 0; i < iterations; i++) {
    let rowId;
    let id = (rowId = i.toString());
    let startDayjs = GSTC.api
      .date(startDate)
      .startOf('day')
      .add(Math.floor(Math.random() * 365 * 2), 'days');
    items[id] = {
      id,
      label: 'item id ' + id,
      random: Math.round(Math.random() * 10000),
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
  return { rows, items };
}

// @ts-ignore
window.generateRowsAndItems = generateRowsAndItems;

const { rows, items } = generateRowsAndItems(100);

const columns = {
  data: {
    id: {
      id: 'id',
      data: 'id',
      width: 50,
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

function CellSlot(vido, props) {
  const { html, onChange, api } = vido;
  onChange((changedProps) => {
    props = changedProps;
  });
  return () =>
    html`<div class="cell-slot cell-slot-${props.row.id}" style="color: #ccc;font-size: 10px;">
      SLOT ${props.row.id}<br />${api.getItem(props.row.$data.items[0]).random}<br />${props.time.leftGlobalDate.format(
        'DD'
      )}
    </div>`;
}

const config = {
  list: {
    rows,
    columns,
  },
  chart: {
    items,
  },
  slots: {
    'chart-timeline-grid-row-cell': { inside: [CellSlot] },
  },
};

var state = GSTC.api.stateFromConfig(config);
const element = document.getElementById('app');

element.addEventListener('gstc-loaded', () => {
  console.log('loaded'); // eslint-disable-line
  gstc.api.scrollToTime(gstc.api.time.date().valueOf()); // eslint-disable-line
});

var gstc = GSTC({
  element,
  state,
});

function reload(iterations = 100) {
  console.log('reload from js'); // eslint-disable-line no-console
  const { rows, items } = generateRowsAndItems(iterations);
  state.update('config', (config) => {
    config.list.rows = rows;
    config.chart.items = items;
    return config;
  });
}
//@ts-ignore
window.reload = reload;
//@ts-ignore
window.state = state;
//@ts-ignore
window.gstc = gstc;
