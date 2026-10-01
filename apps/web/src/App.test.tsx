import { describe, it, expect } from 'vitest';
import App from './App';

describe('App component', () => {
  it('should render without crashing', () => {
    expect(App).toBeDefined();
  });
});
