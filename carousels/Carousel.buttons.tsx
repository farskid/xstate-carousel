import * as React from 'react';
import { createMachine, assign } from 'xstate';
import { useMachine } from '@xstate/react';
import { isBuiltInEvent } from 'xstate/lib/utils';

const ITEM_SIZE = 600;

const getImgUrl =
  () => `https://api.lorem.space/image/pizza?w=${ITEM_SIZE}&h=${ITEM_SIZE}&hash=${Math.random()}
`;

const loadImage = () => {
  return new Promise((resolve, reject) => {
    const img = new Image(ITEM_SIZE, ITEM_SIZE);
    img.onload = () => {
      resolve(img.src);
    };
    img.onerror = () => {
      reject();
    };
    setTimeout(() => {
      img.src = getImgUrl();
    }, 2000);
  });
};

const carouselMachine = createMachine({
  initial: 'loading',
  schema: {
    context: {} as {
      cursor: number;
      total: number;
      images: string[];
    },
  },
  context: {
    cursor: 0,
    total: 5,
    images: Array.from({ length: 5 }, (_, i) => i.toString()),
  },
  states: {
    loading: {
      entry: ['scrollToItem'],
      invoke: {
        src: 'loadImages',
        onDone: {
          target: 'loaded',
          actions: ['saveImages'],
        },
        onError: {
          target: 'failed',
        },
      },
    },
    failed: {
      tags: ['failed'],
      on: {
        reload: 'loading',
      },
    },
    loaded: {
      initial: 'start',
      tags: ['loaded'],
      on: {
        reset: {
          target: '.start',
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
              { target: 'middle', actions: ['decrementCursor'] },
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
    },
  },
});

export default function App() {
  const railRef = React.useRef<HTMLDivElement | null>(null);
  const [state, send] = useMachine(carouselMachine, {
    context: {
      cursor: 0,
      total: 10,
      images: Array.from({ length: 10 }, (_, i) => i.toString()),
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
      saveImages: assign({
        images: (_, e) => {
          return e.data;
        },
      }),
    },
    services: {
      loadImages: (ctx) => {
        return Promise.all(Array.from({ length: ctx.total }).map(loadImage));
      },
    },
  });

  const nextEvents = state.nextEvents
    .filter((evt) => state.can(evt) && !isBuiltInEvent(evt))
    .sort();

  return (
    <div style={{ '--item-size': ITEM_SIZE + 'px' }}>
      <p>state: {JSON.stringify(state.value)}</p>
      <p>cursor: {state.context.cursor}</p>
      <div className="car-container" ref={railRef}>
        <ul className="car-rail">
          {state.context.images.map((img, i) => (
            <li key={i}>
              <p>{i}</p>
              {state.hasTag('loaded') ? (
                <img src={img} />
              ) : (
                <div
                  style={{
                    width: ITEM_SIZE,
                    height: ITEM_SIZE,
                    backgroundColor: 'gray',
                    display: 'grid',
                    placeContent: 'center',
                    fontSize: '30px',
                  }}
                >
                  Loading
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
      <div>
        {/* <button
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
        {state.hasTag('failed') && (
          <button
            onClick={() => {
              send({ type: 'reload' });
            }}
          >
            reload
          </button>
        )} */}
        {nextEvents.map((evt) => (
          <button
            key={evt}
            disabled={!state.can(evt)}
            onClick={() => {
              send({ type: evt });
            }}
          >
            {evt}
          </button>
        ))}
      </div>
    </div>
  );
}
