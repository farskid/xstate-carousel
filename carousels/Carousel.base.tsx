import * as React from 'react';
import { createMachine, assign } from 'xstate';
import { useMachine } from '@xstate/react';

const ITEM_SIZE = 600;

const getImgUrl =
  () => `https://api.lorem.space/image/pizza?w=${ITEM_SIZE}&h=${ITEM_SIZE}&hash=${Math.random()}
`;

const carouselMachine = createMachine({
  initial: 'start',
  schema: {
    context: {} as {
      cursor: number;
      total: number;
    },
  },
  context: {
    cursor: 0,
    total: 5,
  },
  on: {
    reset: {
      target: 'start',
      actions: ['resetContext'],
    },
  },
  states: {
    start: {
      entry: ['scrollToItem'],
      on: {
        next: {
          target: 'middle',
          actions: ['incrementCursor'],
        },
      },
    },
    middle: {
      entry: ['scrollToItem'],
      on: {
        next: [
          {
            target: 'end',
            cond: 'isLastCursor',
            actions: ['incrementCursor'],
          },
          {
            target: 'middle',
            actions: ['incrementCursor'],
          },
        ],
        prev: [
          {
            target: 'start',
            actions: ['decrementCursor'],
            cond: 'isFirstCursor',
          },
          {
            target: 'middle',
            actions: ['decrementCursor'],
          },
        ],
      },
    },
    end: {
      entry: ['scrollToItem'],
      on: {
        prev: {
          target: 'middle',
          actions: ['decrementCursor'],
        },
      },
    },
  },
});

const images = [0, 1, 2, 3, 4, 5, 6].map(() => getImgUrl());

export default function App() {
  const railRef = React.useRef<HTMLDivElement | null>(null);
  const [state, send] = useMachine(carouselMachine, {
    context: {
      cursor: 0,
      total: images.length,
    },
    guards: {
      isFirstCursor: (ctx) => ctx.cursor === 1,
      isLastCursor: (ctx) => ctx.cursor === ctx.total - 2, // index is off by 1
    },
    actions: {
      incrementCursor: assign({
        cursor: (ctx) => ctx.cursor + 1,
      }),
      decrementCursor: assign({
        cursor: (ctx) => ctx.cursor - 1,
      }),
      scrollToItem: (ctx) => {
        railRef!.current.querySelectorAll('li')[ctx.cursor].scrollIntoView({
          inline: 'center',
          block: 'nearest',
        });
      },
      resetContext: assign({
        cursor: (ctx) => 0,
      }),
    },
  });

  return (
    <div style={{ '--item-size': ITEM_SIZE + 'px' }}>
      <p>state: {JSON.stringify(state.value)}</p>
      <p>cursor: {state.context.cursor}</p>
      <div className="car-container" ref={railRef}>
        <ul className="car-rail">
          {images.map((img, i) => (
            <li key={i}>
              <p>{i}</p>
              <img src={img} />
            </li>
          ))}
        </ul>
      </div>
      <div>
        <button
          onClick={() => {
            send({ type: 'next' });
          }}
        >
          next
        </button>
        <button
          onClick={() => {
            send({ type: 'prev' });
          }}
        >
          prev
        </button>
        <button
          onClick={() => {
            send({ type: 'reset' });
          }}
        >
          reset
        </button>
      </div>
    </div>
  );
}
