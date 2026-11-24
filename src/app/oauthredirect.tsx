import { router, Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { colors } from '../theme';

WebBrowser.maybeCompleteAuthSession();

/**
 * Google sign-in returns to familyfin:///oauthredirect. The sign-in button already receives that link
 * and finishes signing in, so this screen only steps back to where the user was (Settings).
 */
export default function OAuthRedirect() {
  useEffect(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/settings');
  }, []);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}
