import React, { useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { usePro } from '../purchases/PurchasesContext';
import { useAuth } from '../auth/AuthContext';
import { Sheet } from '../components/Sheet';
import { Button } from '../components/Button';
import { colors, font, radius, spacing } from '../theme';

export function SubscriptionScreen() {
  const navigation = useNavigation();
  const { isPro, isTrialing, trialDaysLeft } = usePro();
  const { deleteAccount } = useAuth();
  const [cancelSheet, setCancelSheet] = useState(false);
  const [deleteSheet, setDeleteSheet] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const planLabel = !isPro
    ? '무료 플랜'
    : isTrialing
    ? `무료 체험 중 · D-${trialDaysLeft}`
    : '프리미엄';

  const openStore = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('https://apps.apple.com/account/subscriptions');
    } else {
      Linking.openURL('https://play.google.com/store/account/subscriptions');
    }
  };

  const doDeleteAccount = async () => {
    setDeleteBusy(true);
    try {
      await deleteAccount();
      // RootNavigator가 first_launch_completed 확인 후 온보딩으로 보냄
    } catch {
      Alert.alert('오류', '탈퇴 처리 중 문제가 발생했어요. 다시 시도해주세요.');
      setDeleteBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ 뒤로</Text>
        </Pressable>
        <Text style={styles.title}>구독 관리</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.card}>
          <Text style={styles.label}>현재 플랜</Text>
          <Text style={styles.value}>{planLabel}</Text>
          {isPro && !isTrialing && (
            <>
              <View style={styles.divider} />
              <Text style={styles.label}>다음 결제일</Text>
              <Text style={styles.value}>정보 없음</Text>
            </>
          )}
        </View>

        {isPro && (
          <Button
            title={Platform.OS === 'ios' ? 'App Store에서 구독 취소' : 'Google Play에서 구독 취소'}
            variant="secondary"
            onPress={() => setCancelSheet(true)}
            style={{ marginTop: spacing.md }}
          />
        )}

        <View style={styles.spacer} />

        <Pressable onPress={() => setDeleteSheet(true)} style={styles.deleteBtn}>
          <Text style={styles.deleteText}>회원 탈퇴</Text>
        </Pressable>
      </ScrollView>

      {/* 구독 취소 안내 Sheet */}
      <Sheet visible={cancelSheet} title="구독 취소" onClose={() => setCancelSheet(false)}>
        <Text style={styles.sheetBody}>
          떠나시는군요 😢{'\n\n'}
          그동안 쌓아온 일기들은 그대로 남아있어요.{'\n'}
          단, 사진은 구독 종료 후 180일 뒤 자동으로 정리되니 미리 저장해두세요 📷
        </Text>
        <Text style={[styles.sheetBody, { marginTop: spacing.sm, color: colors.textMuted }]}>
          {Platform.OS === 'ios'
            ? 'App Store → 구매 내역 → 구독 → MyDiary에서 취소할 수 있어요.'
            : 'Google Play → 구독에서 MyDiary를 찾아 취소할 수 있어요.'}
        </Text>
        <Button
          title={Platform.OS === 'ios' ? 'App Store에서 취소하기' : 'Google Play에서 취소하기'}
          onPress={() => { setCancelSheet(false); openStore(); }}
          style={{ marginTop: spacing.lg }}
        />
        <Button
          title="아직 괜찮아요"
          variant="ghost"
          onPress={() => setCancelSheet(false)}
          style={{ marginTop: spacing.sm }}
        />
      </Sheet>

      {/* 회원 탈퇴 Sheet */}
      <Sheet visible={deleteSheet} title="회원 탈퇴" onClose={() => setDeleteSheet(false)}>
        <Text style={styles.sheetBody}>
          모든 일기와 사진이 영구 삭제되며 복구가 불가능해요.
        </Text>
        <Button
          title="탈퇴하기"
          onPress={doDeleteAccount}
          loading={deleteBusy}
          style={{ marginTop: spacing.lg, backgroundColor: colors.danger }}
        />
        <Button
          title="취소"
          variant="ghost"
          onPress={() => setDeleteSheet(false)}
          style={{ marginTop: spacing.sm }}
        />
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, paddingBottom: spacing.sm },
  backBtn: { marginRight: spacing.md },
  backText: { fontSize: font.body, color: colors.primary },
  title: { fontSize: font.heading, fontWeight: '700', color: colors.text },
  body: { padding: spacing.lg, paddingBottom: spacing.xl },
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.lg },
  label: { fontSize: font.tiny, color: colors.textMuted, marginBottom: spacing.xs },
  value: { fontSize: font.body, fontWeight: '600', color: colors.text },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  spacer: { height: spacing.xl * 3 },
  deleteBtn: { alignItems: 'center', paddingVertical: spacing.sm },
  deleteText: { fontSize: font.small, color: colors.textMuted },
  sheetBody: { fontSize: font.body, color: colors.text, lineHeight: 24 },
});
