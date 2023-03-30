import * as React from 'react';
import { createMachine, assign, raise } from 'xstate';
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
      startIndex: number;
      cursor: number;
      total: number;
      images: string[];
      cyclic: boolean;
      autoPlay?: number;
    },
  },
  context: {
    startIndex: 0,
    cursor: 0,
    total: 5,
    images: Array.from({ length: 5 }, (_, i) => i.toString()),
    cyclic: false,
    autoPlay: undefined,
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
      tags: ['loaded'],
      entry: ['enableSmoothScroll'], // disable it in style.css too
      type: 'parallel',
      states: {
        autoPlay: {
          initial: 'checkingInitialState',
          states: {
            checkingInitialState: {
              always: [
                {
                  target: 'enabled',
                  cond: 'autoPlayIsEnabled',
                },
                { target: 'disabled' },
              ],
            },
            enabled: {
              initial: 'playing',
              on: {
                disbleAutoPlay: 'disabled',
              },
              states: {
                paused: {
                  on: {
                    play: 'playing',
                  },
                },
                playing: {
                  initial: 'idle',
                  on: {
                    pause: 'paused',
                  },
                  states: {
                    idle: {
                      after: {
                        autoPlay: 'ticking',
                      },
                    },
                    ticking: {
                      entry: ['goNext'],
                      always: 'idle',
                    },
                  },
                },
              },
            },
            disabled: {
              on: {
                enableAutoPlay: 'enabled',
              },
            },
          },
        },
        carousel: {
          initial: 'checkingInitialState',
          on: {
            reset: {
              target: '.checkingInitialState',
              actions: ['resetContext'],
            },
          },
          states: {
            checkingInitialState: {
              always: [
                { target: 'start', cond: 'isStartIndexFirstCursor' },
                { target: 'end', cond: 'isStartIndexLastCursor' },
                { target: 'middle' },
              ],
            },
            start: {
              entry: ['scrollToItem'],
              on: {
                next: {
                  target: 'middle',
                  actions: ['incrementCursor'],
                },
                prev: {
                  target: 'end',
                  actions: ['setCursorToLast'],
                  cond: 'isCyclic',
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
                next: {
                  target: 'start',
                  actions: ['setCursorToFirst'],
                  cond: 'isCyclic',
                },
              },
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
      startIndex: 5,
      cursor: 5,
      total: 10,
      images: Array.from({ length: 10 }, (_, i) => i.toString()),
      autoPlay: 2000,
      cyclic: true,
    },
    delays: {
      autoPlay: (ctx) => ctx.autoPlay,
    },
    guards: {
      isFirstCursor: (ctx) => ctx.cursor === 1,
      isLastCursor: (ctx) => ctx.cursor === ctx.total - 2, // index is off by 1
      isStartIndexFirstCursor: (ctx) => ctx.startIndex === 0,
      isStartIndexLastCursor: (ctx) => ctx.startIndex === ctx.total - 1,
      isCyclic: (ctx) => ctx.cyclic,
      autoPlayIsEnabled: (ctx) => typeof ctx.autoPlay === 'number',
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
        cursor: (ctx) => ctx.startIndex,
      }),
      saveImages: assign({
        images: (_, e) => {
          return e.data;
        },
      }),
      enableSmoothScroll: (ctx) => {
        railRef!.current.style.scrollBehavior = 'smooth';
      },
      setCursorToLast: assign({ cursor: (ctx) => ctx.total - 1 }),
      setCursorToFirst: assign({ cursor: (ctx) => 0 }),
      goNext: raise({ type: 'next' }),
    },
    services: {
      loadImages: (ctx) => {
        return Promise.all(Array.from({ length: ctx.total }).map(loadImage));
      },
    },
  });

  const nextEvents = state.nextEvents
    .filter(
      (evt) =>
        state.can(evt) &&
        !isBuiltInEvent(evt) &&
        !evt.startsWith('xstate.after')
    )
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
