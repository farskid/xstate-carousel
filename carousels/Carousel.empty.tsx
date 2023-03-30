import * as React from 'react';
import { createMachine } from 'xstate';
import { useMachine } from '@xstate/react';

const ITEM_SIZE = 600;

const getImgUrl =
  () => `https://api.lorem.space/image/pizza?w=${ITEM_SIZE}&h=${ITEM_SIZE}&hash=${Math.random()}
`;

const carouselMachine = createMachine({});

const images = [0, 1, 2, 3, 4, 5, 6].map(() => getImgUrl());

export default function App() {
  const railRef = React.useRef<HTMLDivElement | null>(null);
  const [state] = useMachine(carouselMachine);

  return (
    <div style={{ '--item-size': ITEM_SIZE + 'px' }}>
      <p>state: {JSON.stringify(state.value)}</p>
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
        <button>next</button>
        <button>prev</button>
        <button>reset</button>
      </div>
    </div>
  );
}
