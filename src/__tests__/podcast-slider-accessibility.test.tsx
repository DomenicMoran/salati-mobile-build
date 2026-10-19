import { render, screen, fireEvent } from '@testing-library/react-native';
import { Slider } from '@/features/podcast/slider';
import { Platform } from 'react-native';
jest.mock('@/hooks/use-resolved-scheme', () => ({ useResolvedScheme: () => 'light' }));

describe('browser keyboard control', () => {
  const nativeOS = Platform.OS;
  beforeEach(() => { Platform.OS = 'web'; });
  afterEach(() => { Platform.OS = nativeOS; });
  it.each([
    ['ArrowRight', 0.25], ['ArrowUp', 0.25], ['ArrowLeft', 0.15], ['ArrowDown', 0.15],
    ['PageUp', 0.3], ['PageDown', 0.1], ['Home', 0], ['End', 1],
  ])('supports %s without scrolling the page', async (key, expected) => {
    const commit = jest.fn(); const change = jest.fn(); const preventDefault = jest.fn();
    await render(<Slider value={0.2} onChange={change} onCommit={commit} accessibilityLabel="Position" />);
    const slider = screen.getByLabelText('Position');
    expect(slider.props.tabIndex).toBe(0);
    await fireEvent(slider, 'keyDown', {key, preventDefault});
    expect(commit.mock.calls[0][0]).toBeCloseTo(expected as number);
    expect(change.mock.calls[0][0]).toBeCloseTo(expected as number);
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });
  it('keeps Tab navigation and unrelated keys unchanged', async () => {
    const commit = jest.fn(); const preventDefault = jest.fn();
    await render(<Slider value={0.2} onCommit={commit} accessibilityLabel="Position" />);
    await fireEvent(screen.getByLabelText('Position'), 'keyDown', {key:'Tab', preventDefault});
    expect(commit).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });
  it('retains consecutive key commands while the media seek acknowledgment is pending', async () => {
    const commit=jest.fn();
    await render(<Slider value={0.4} onCommit={commit} accessibilityLabel="Position" />);
    const slider=screen.getByLabelText('Position');
    for (const key of ['Home','ArrowRight','ArrowRight']) {
      await fireEvent(slider,'keyDown',{key,preventDefault:jest.fn()});
    }
    expect(commit.mock.calls.map(([value])=>value)).toEqual([0,0.05,0.1]);
  });
  it.each([[0,'ArrowLeft',0],[1,'ArrowRight',1]])('clamps keyboard changes at %s', async (value,key,expected) => {
    const commit=jest.fn();
    await render(<Slider value={value as number} onCommit={commit} accessibilityLabel="Position" />);
    await fireEvent(screen.getByLabelText('Position'), 'keyDown', {key,preventDefault:jest.fn()});
    expect(commit).toHaveBeenCalledWith(expected);
  });
});

it('exposes the real progress and supports assistive increment actions', async () => {
  const commit = jest.fn();
  await render(<Slider value={0.2} onCommit={commit} accessibilityLabel="Position" />);
  const slider = screen.getByLabelText('Position');
  expect(slider.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 20 });
  // RN Web does not translate the native accessibilityValue object.
  expect(slider.props['aria-valuemin']).toBe(0);
  expect(slider.props['aria-valuemax']).toBe(100);
  expect(slider.props['aria-valuenow']).toBe(20);
  await fireEvent(slider, 'accessibilityAction', {nativeEvent: {actionName: 'increment'}});
  expect(commit).toHaveBeenCalledWith(0.25);
});

it('clamps assistive decrement actions at zero', async () => {
  const commit = jest.fn();
  await render(<Slider value={0} onCommit={commit} accessibilityLabel="Position" />);
  await fireEvent(screen.getByLabelText('Position'), 'accessibilityAction', {nativeEvent: {actionName: 'decrement'}});
  expect(commit).toHaveBeenCalledWith(0);
});
