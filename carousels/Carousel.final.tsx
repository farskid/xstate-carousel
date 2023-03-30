import * as React from 'react';
import './style.css';
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

const carouselMachine = createMachine(
  {
    initial: 'loading',
    schema: {
      context: {} as {
        startIndex: number;
        cursor: number;
        total: number;
        cyclic: boolean;
        images: string[];
        autoPlay?: number;
      },
    },
    context: {
      startIndex: 0,
      cursor: 0,
      total: 5,
      cyclic: false,
      autoPlay: undefined,
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
        tags: ['loaded'],
        entry: ['enableSmoothScroll'],

        type: 'parallel',
        states: {
          keyboard: {
            invoke: {
              src: 'registerArrowKeys',
            },
          },
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
              goTo: {
                target: '.checkingInitialState',
                actions: ['setArbitraryCursor'],
              },
            },
            states: {
              checkingInitialState: {
                always: [
                  { target: 'start', cond: 'startIndexIsFirst' },
                  { target: 'end', cond: 'startIndexIsLast' },
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
  },
  {
    services: {
      loadImages: (ctx) => {
        return Promise.all(Array.from({ length: ctx.total }).map(loadImage));
      },
      registerArrowKeys: () => (sendBack) => {
        const handler = (e: KeyboardEvent) => {
          switch (e.key) {
            case 'ArrowRight': {
              e.preventDefault();
              sendBack({ type: 'next' });
              break;
            }
            case 'ArrowLeft': {
              e.preventDefault();
              sendBack({ type: 'prev' });
              break;
            }
            default:
          }
        };
        document.addEventListener('keydown', handler);
        return () => {
          document.removeEventListener('keydown', handler);
        };
      },
    },
    delays: {
      autoPlay: (ctx) => ctx.autoPlay,
    },
    guards: {
      isFirstCursor: (ctx) => ctx.cursor === 1,
      isLastCursor: (ctx) => ctx.cursor === ctx.total - 2, // index is off by 1
      isCyclic: (ctx) => ctx.cyclic,
      autoPlayIsEnabled: (ctx) => typeof ctx.autoPlay === 'number',
      startIndexIsFirst: (ctx) => ctx.startIndex === 0,
      startIndexIsLast: (ctx) => ctx.startIndex === ctx.total - 1,
    },
    actions: {
      incrementCursor: assign({
        cursor: (ctx) => ctx.cursor + 1,
      }),
      decrementCursor: assign({
        cursor: (ctx) => ctx.cursor - 1,
      }),
      setCursorToLast: assign({ cursor: (ctx) => ctx.total - 1 }),
      setCursorToFirst: assign({ cursor: (ctx) => 0 }),
      resetContext: assign({
        cursor: (ctx) => ctx.startIndex,
      }),
      saveImages: assign({
        images: (_, e) => {
          return e.data;
        },
      }),
      goNext: raise({ type: 'next' }),
      setArbitraryCursor: assign({
        cursor: (_, e) => e.cursor,
      }),
    },
  }
);

export default function App() {
  const railRef = React.useRef<HTMLDivElement | null>(null);
  const [state, send, actor] = useMachine(carouselMachine, {
    context: {
      startIndex: 3,
      total: 10,
      images: Array.from({ length: 10 }, (_, i) => i.toString()),
      cyclic: true,
      autoPlay: 3000,
    },
    actions: {
      enableSmoothScroll: (ctx) => {
        railRef!.current.style.scrollBehavior = 'smooth';
      },
      scrollToItem: (ctx) => {
        railRef!.current.querySelectorAll('li')[ctx.cursor].scrollIntoView({
          inline: 'center',
          block: 'nearest',
        });
      },
    },
  });
  const nextEvents = state.nextEvents
    .filter(
      (evt) =>
        state.can(evt) &&
        !isBuiltInEvent(evt) &&
        !evt.startsWith('xstate.after') &&
        evt !== 'goTo'
    )
    .sort();
  return (
    <div style={{ '--item-size': ITEM_SIZE + 'px' }}>
      <p>state: {JSON.stringify(state.value)}</p>
      <p>
        auto play state:{' '}
        {JSON.stringify(state.children.autoPlay?.getSnapshot().value)}
      </p>
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
        <select
          onChange={(e) => {
            send({ type: 'goTo', cursor: e.target.selectedIndex });
          }}
        >
          {state.context.images.map((_, i) => (
            <option key={i} value={i}>
              {i + 1}
            </option>
          ))}
        </select>
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

        {/* <button
          disabled={!state.can('next')}
          onClick={() => {
            send({ type: 'next' });
          }}
        >
          next
        </button>
        <button
          disabled={!state.can('prev')}
          onClick={() => {
            send({ type: 'prev' });
          }}
        >
          prev
        </button>
        <button
          disabled={!state.can('reset')}
          onClick={() => {
            send({ type: 'reset' });
          }}
        >
          reset
        </button>
        <button
          disabled={!state.can('pause')}
          onClick={() => {
            send({ type: 'pause' });
          }}
        >
          pause
        </button>
        <button
          disabled={!state.can('play')}
          onClick={() => {
            send({ type: 'play' });
          }}
        >
          play
        </button>
        <button
          disabled={!state.can('disableAutoPlay')}
          onClick={() => {
            send({ type: 'disableAutoPlay' });
          }}
        >
          disableAutoPlay
        </button>
        <button
          disabled={!state.can('enableAutoPlay')}
          onClick={() => {
            send({ type: 'enableAutoPlay' });
          }}
        >
          enableAutoPlay
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
      </div>
    </div>
  );
}
