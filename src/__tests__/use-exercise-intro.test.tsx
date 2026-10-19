import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pressable, Text } from 'react-native';
import type { Context } from 'react';
import { useExerciseIntro } from '@/hooks/use-exercise-intro';

jest.mock('expo-router', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const focusContext = React.createContext(false);
  return {
    __testFocusContext: focusContext,
    useFocusEffect: (callback: () => void | (() => void)) => {
      const focused = React.useContext(focusContext);
      React.useEffect(() => {
        if (!focused) return undefined;
        return callback();
      }, [callback, focused]);
    },
  };
});

const FocusContext = jest.requireMock('expo-router').__testFocusContext as Context<boolean>;

function IntroContent() {
  const intro = useExerciseIntro('puzzle');
  return (
    <>
      <Text>{intro.visible ? 'intro-visible' : 'intro-hidden'}</Text>
      <Pressable testID="dismiss-intro" onPress={intro.dismiss} />
    </>
  );
}

function IntroHarness({ focused }: { focused: boolean }) {
  return (
    <FocusContext.Provider value={focused}>
      <IntroContent />
    </FocusContext.Provider>
  );
}

describe('useExerciseIntro focus lifecycle', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.restoreAllMocks();
  });

  it('ignores an async first-visit lookup that resolves after blur', async () => {
    let resolveSeen!: (value: string | null) => void;
    jest.spyOn(AsyncStorage, 'getItem').mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSeen = resolve;
      }),
    );

    const view = await render(<IntroHarness focused />);
    await view.rerender(<IntroHarness focused={false} />);
    resolveSeen(null);

    await waitFor(() => expect(screen.getByText('intro-hidden')).toBeTruthy());
  });

  it('hides on blur without marking seen; refocus shows it again and dismiss marks it seen', async () => {
    const view = await render(<IntroHarness focused />);
    await waitFor(() => expect(screen.getByText('intro-visible')).toBeTruthy());

    await view.rerender(<IntroHarness focused={false} />);
    await waitFor(() => expect(screen.getByText('intro-hidden')).toBeTruthy());
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();

    await view.rerender(<IntroHarness focused />);
    await waitFor(() => expect(screen.getByText('intro-visible')).toBeTruthy());
    fireEvent.press(screen.getByTestId('dismiss-intro'));
    await waitFor(() => expect(screen.getByText('intro-hidden')).toBeTruthy());
    await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'salatibox:seenIntros',
      expect.stringContaining('puzzle'),
    ));
  });
});
