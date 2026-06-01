import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { PACKAGE_TYPE } from 'react-native-purchases';
import { usePro } from '../purchases/PurchasesContext';
import { colors, font, radius, spacing } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const COMPARE = [
  { label: '질문 수신', free: true, pro: true, proNote: '' },
  { label: '답변 저장', free: true, pro: true, proNote: '' },
  { label: '과거 기록', free: true, pro: true, proNote: '' },
  { label: '클라우드 백업', free: true, pro: true, proNote: '' },
  { label: 'AI 일기 완성', free: false, pro: true, proNote: '매일 밤' },
  { label: '사진 첨부', free: false, pro: true, proNote: '하루 1장' },
  { label: '월간 리포트', free: false, pro: true, proNote: '매월 발송' },
];

export function PaywallScreen() {
  const navigation = useNavigation<Nav>();
  const { currentOffering, purchase, isLoading } = usePro();
  const [selected, setSelected] = useState<'monthly' | 'annual'>('annual');
  const [busy, setBusy] = useState(false);

  const monthlyPkg = currentOffering?.availablePackages.find(
    (p) => p.packageType === PACKAGE_TYPE.MONTHLY
  );
  const annualPkg = currentOffering?.availablePackages.find(
    (p) => p.packageType === PACKAGE_TYPE.ANNUAL
  );
  const selectedPkg = selected === 'annual' ? annualPkg : monthlyPkg;

  const doPurchase = async () => {
    if (!selectedPkg) {
      Alert.alert('알림', '구독 상품을 불러오는 중이에요. 잠시 후 다시 시도해주세요.');
      return;
    }
    setBusy(true);
    try {
      await purchase(selectedPkg);
      navigation.goBack();
    } catch (e: unknown) {
      const err = e as { userCancelled?: boolean; message?: string };
      if (!err.userCancelled) Alert.alert('결제 오류', err.message ?? '다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Pressable style={styles.closeBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.closeText}>✕</Text>
      </Pressable>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* 샘플 일기 미리보기 */}
        <View style={styles.previewCard}>
          <Text style={styles.previewText} numberOfLines={3}>
            오늘은 유난히 긴 하루였다. 점심에 먹은 된장찌개가...
          </Text>
          <View style={styles.previewBlur} />
          <View style={styles.lockBadge}>
            <Text style={styles.lockIcon}>🔒</Text>
          </View>
        </View>
        <Text style={styles.previewHint}>구독하면 전체 일기를 볼 수 있어요</Text>

        {/* 비교표 */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={styles.tableCol} />
            <Text style={styles.tableHeadFree}>무료</Text>
            <Text style={styles.tableHeadPro}>프리미엄</Text>
          </View>
          {COMPARE.map((row) => (
            <View key={row.label} style={styles.tableRow}>
              <Text style={styles.tableLabel}>{row.label}</Text>
              <Text style={[styles.tableCell, !row.free && styles.tableCellOff]}>
                {row.free ? '✅' : '❌'}
              </Text>
              <View style={styles.tableCellPro}>
                <Text style={styles.tableCell}>{row.pro ? '✅' : '❌'}</Text>
                {!!row.proNote && <Text style={styles.tableNote}>{row.proNote}</Text>}
              </View>
            </View>
          ))}
        </View>

        {/* 플랜 선택 */}
        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
        ) : (
          <View style={styles.plans}>
            <Pressable
              style={[styles.planCard, selected === 'monthly' && styles.planCardActive]}
              onPress={() => setSelected('monthly')}
            >
              <Text style={[styles.planTitle, selected === 'monthly' && styles.planTitleActive]}>
                월간
              </Text>
              <Text style={[styles.planPrice, selected === 'monthly' && styles.planPriceActive]}>
                {monthlyPkg?.product.priceString ?? '3,900원'} / 월
              </Text>
            </Pressable>
            <Pressable
              style={[styles.planCard, selected === 'annual' && styles.planCardActive]}
              onPress={() => setSelected('annual')}
            >
              <View style={styles.bestBadge}>
                <Text style={styles.bestText}>15% 할인</Text>
              </View>
              <Text style={[styles.planTitle, selected === 'annual' && styles.planTitleActive]}>
                연간
              </Text>
              <Text style={[styles.planPrice, selected === 'annual' && styles.planPriceActive]}>
                {annualPkg?.product.priceString ?? '39,900원'} / 년
              </Text>
              <Text style={styles.planSub}>월 3,325원</Text>
            </Pressable>
          </View>
        )}

        {/* CTA */}
        <Pressable
          style={[styles.ctaBtn, busy && styles.ctaBtnDisabled]}
          onPress={doPurchase}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.ctaText}>7일 무료로 시작하기</Text>
          )}
        </Pressable>
        <Text style={styles.ctaNote}>7일 후 자동 결제되지 않아요</Text>

        <Pressable onPress={() => navigation.goBack()} style={styles.laterBtn}>
          <Text style={styles.laterText}>나중에 할래요</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  closeBtn: { position: 'absolute', top: spacing.xl, right: spacing.lg, zIndex: 10, padding: spacing.sm },
  closeText: { fontSize: 18, color: colors.textMuted },
  body: { padding: spacing.lg, paddingTop: spacing.xl + spacing.lg, paddingBottom: spacing.xl },

  previewCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.xs,
    overflow: 'hidden',
    minHeight: 80,
  },
  previewText: { fontSize: font.body, color: colors.text, lineHeight: 24 },
  previewBlur: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    height: 50,
    backgroundColor: colors.card,
    opacity: 0.85,
  },
  lockBadge: { position: 'absolute', right: spacing.md, bottom: spacing.md },
  lockIcon: { fontSize: 22 },
  previewHint: { fontSize: font.small, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg },

  table: { backgroundColor: colors.card, borderRadius: radius.md, overflow: 'hidden', marginBottom: spacing.lg },
  tableHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  tableCol: { flex: 1 },
  tableHeadFree: { width: 44, textAlign: 'center', fontSize: font.small, color: colors.textSecondary, fontWeight: '600' },
  tableHeadPro: { width: 72, textAlign: 'center', fontSize: font.small, color: colors.primary, fontWeight: '700' },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  tableLabel: { flex: 1, fontSize: font.small, color: colors.text },
  tableCell: { width: 44, textAlign: 'center', fontSize: 14 },
  tableCellOff: { opacity: 0.5 },
  tableCellPro: { width: 72, alignItems: 'center' },
  tableNote: { fontSize: 10, color: colors.primary, marginTop: 1 },

  plans: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  planCard: {
    flex: 1, backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md,
    borderWidth: 2, borderColor: colors.border,
  },
  planCardActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  bestBadge: { backgroundColor: colors.primary, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2, alignSelf: 'flex-start', marginBottom: spacing.xs },
  bestText: { color: colors.white, fontSize: 10, fontWeight: '700' },
  planTitle: { fontSize: font.small, fontWeight: '700', color: colors.textSecondary },
  planTitleActive: { color: colors.primary },
  planPrice: { fontSize: font.body, fontWeight: '800', color: colors.text, marginTop: spacing.xs },
  planPriceActive: { color: colors.primary },
  planSub: { fontSize: font.tiny, color: colors.textMuted, marginTop: 2 },

  ctaBtn: { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginBottom: spacing.sm },
  ctaBtnDisabled: { opacity: 0.6 },
  ctaText: { color: colors.white, fontSize: font.body, fontWeight: '800' },
  ctaNote: { fontSize: font.tiny, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.lg },
  laterBtn: { alignItems: 'center', paddingVertical: spacing.sm },
  laterText: { fontSize: font.small, color: colors.textMuted },
});
