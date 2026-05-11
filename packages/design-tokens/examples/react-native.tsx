/**
 * AcuityBookmarks Design Tokens - React Native 示例
 * 
 * 展示如何在 React Native 项目中使用设计 tokens
 */

import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  SafeAreaView
} from 'react-native'

// 导入 Design Tokens
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  lineHeight,
  borderRadius,
  shadows
} from '@acuity-bookmarks/design-tokens'

// ============================================
// 按钮组件
// ============================================

interface ButtonProps {
  children: React.ReactNode
  variant?: 'primary' | 'secondary' | 'outline'
  onPress?: () => void
}

const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', onPress }) => {
  const buttonStyles = [
    styles.button,
    variant === 'primary' && styles.buttonPrimary,
    variant === 'secondary' && styles.buttonSecondary,
    variant === 'outline' && styles.buttonOutline
  ]

  const textStyles = [
    styles.buttonText,
    variant === 'primary' && styles.buttonTextPrimary,
    variant === 'secondary' && styles.buttonTextSecondary,
    variant === 'outline' && styles.buttonTextOutline
  ]

  return (
    <TouchableOpacity style={buttonStyles} onPress={onPress} activeOpacity={0.8}>
      <Text style={textStyles}>{children}</Text>
    </TouchableOpacity>
  )
}

// ============================================
// 卡片组件
// ============================================

interface CardProps {
  title: string
  description: string
}

const Card: React.FC<CardProps> = ({ title, description }) => {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardDescription}>{description}</Text>
    </View>
  )
}

// ============================================
// 徽章组件
// ============================================

interface BadgeProps {
  children: React.ReactNode
  variant?: 'success' | 'error' | 'warning' | 'info' | 'ai'
}

const Badge: React.FC<BadgeProps> = ({ children, variant = 'info' }) => {
  const badgeStyles = [
    styles.badge,
    variant === 'success' && styles.badgeSuccess,
    variant === 'error' && styles.badgeError,
    variant === 'warning' && styles.badgeWarning,
    variant === 'info' && styles.badgeInfo,
    variant === 'ai' && styles.badgeAi
  ]

  const textStyles = [
    styles.badgeText,
    variant === 'success' && styles.badgeTextSuccess,
    variant === 'error' && styles.badgeTextError,
    variant === 'warning' && styles.badgeTextWarning,
    variant === 'info' && styles.badgeTextInfo,
    variant === 'ai' && styles.badgeTextAi
  ]

  return (
    <View style={badgeStyles}>
      <Text style={textStyles}>{children}</Text>
    </View>
  )
}

// ============================================
// 主应用组件
// ============================================

const App: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* 标题 */}
        <Text style={styles.title}>🎨 AcuityBookmarks Design Tokens</Text>
        <Text style={styles.subtitle}>
          这是一个 React Native 示例，展示了如何使用设计系统。
        </Text>

        {/* 按钮示例 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>按钮（Buttons）</Text>
          <View style={styles.buttonGroup}>
            <Button variant="primary">Primary Button</Button>
            <Button variant="secondary">Secondary Button</Button>
            <Button variant="outline">Outline Button</Button>
          </View>
        </View>

        {/* 卡片示例 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>卡片（Cards）</Text>
          <Card
            title="卡片标题 1"
            description="这是一个使用 Material Design 3 设计系统的卡片组件示例。"
          />
          <Card
            title="卡片标题 2"
            description="所有间距、颜色、圆角都使用设计 tokens。"
          />
          <Card
            title="卡片标题 3"
            description="确保在所有平台上保持一致的视觉效果。"
          />
        </View>

        {/* 徽章示例 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>徽章（Badges）</Text>
          <View style={styles.badgeGroup}>
            <Badge variant="success">SUCCESS</Badge>
            <Badge variant="error">ERROR</Badge>
            <Badge variant="warning">WARNING</Badge>
            <Badge variant="info">INFO</Badge>
            <Badge variant="ai">AI FEATURE</Badge>
          </View>
        </View>

        {/* 输入框示例 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>输入框（Inputs）</Text>
          <TextInput
            style={styles.input}
            placeholder="请输入文字..."
            placeholderTextColor={colors.text.tertiary}
          />
          <TextInput
            style={styles.input}
            placeholder="请输入邮箱..."
            placeholderTextColor={colors.text.tertiary}
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            placeholder="请输入密码..."
            placeholderTextColor={colors.text.tertiary}
            secureTextEntry
          />
        </View>

        {/* 颜色色板 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>颜色系统（Colors）</Text>
          <View style={styles.colorPalette}>
            <View style={styles.colorSwatch}>
              <View style={[styles.colorPreview, { backgroundColor: colors.brand.primary }]} />
              <Text style={styles.colorName}>Primary</Text>
              <Text style={styles.colorValue}>{colors.brand.primary}</Text>
            </View>
            <View style={styles.colorSwatch}>
              <View style={[styles.colorPreview, { backgroundColor: colors.brand.secondary }]} />
              <Text style={styles.colorName}>Secondary</Text>
              <Text style={styles.colorValue}>{colors.brand.secondary}</Text>
            </View>
            <View style={styles.colorSwatch}>
              <View style={[styles.colorPreview, { backgroundColor: colors.semantic.success }]} />
              <Text style={styles.colorName}>Success</Text>
              <Text style={styles.colorValue}>{colors.semantic.success}</Text>
            </View>
            <View style={styles.colorSwatch}>
              <View style={[styles.colorPreview, { backgroundColor: colors.semantic.ai }]} />
              <Text style={styles.colorName}>AI</Text>
              <Text style={styles.colorValue}>{colors.semantic.ai}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

// ============================================
// 样式定义
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    padding: parseInt(spacing.lg)
  },

  // 标题
  title: {
    fontSize: parseInt(fontSize['2xl']),
    fontWeight: fontWeight.bold,
    lineHeight: parseFloat(lineHeight.tight) * parseInt(fontSize['2xl']),
    color: colors.brand.primary,
    marginBottom: parseInt(spacing.base)
  },
  subtitle: {
    fontSize: parseInt(fontSize.base),
    lineHeight: parseFloat(lineHeight.normal) * parseInt(fontSize.base),
    color: colors.text.secondary,
    marginBottom: parseInt(spacing.xl)
  },

  // 区块
  section: {
    marginBottom: parseInt(spacing.xl)
  },
  sectionTitle: {
    fontSize: parseInt(fontSize.xl),
    fontWeight: fontWeight.semibold,
    lineHeight: parseFloat(lineHeight.tight) * parseInt(fontSize.xl),
    color: colors.text.primary,
    marginBottom: parseInt(spacing.base)
  },

  // 按钮
  buttonGroup: {
    gap: parseInt(spacing.sm)
  },
  button: {
    paddingVertical: parseInt(spacing.md),
    paddingHorizontal: parseInt(spacing.base),
    borderRadius: parseInt(borderRadius.md),
    alignItems: 'center',
    justifyContent: 'center'
  },
  buttonPrimary: {
    backgroundColor: colors.brand.primary
  },
  buttonSecondary: {
    backgroundColor: colors.brand.secondary
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.brand.primary
  },
  buttonText: {
    fontSize: parseInt(fontSize.sm),
    fontWeight: fontWeight.medium
  },
  buttonTextPrimary: {
    color: colors.neutral.white
  },
  buttonTextSecondary: {
    color: colors.neutral.white
  },
  buttonTextOutline: {
    color: colors.brand.primary
  },

  // 卡片
  card: {
    backgroundColor: colors.background.secondary,
    borderRadius: parseInt(borderRadius.lg),
    padding: parseInt(spacing.base),
    marginBottom: parseInt(spacing.base),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2
  },
  cardTitle: {
    fontSize: parseInt(fontSize.lg),
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: parseInt(spacing.sm)
  },
  cardDescription: {
    fontSize: parseInt(fontSize.base),
    lineHeight: parseFloat(lineHeight.normal) * parseInt(fontSize.base),
    color: colors.text.secondary
  },

  // 徽章
  badgeGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: parseInt(spacing.sm)
  },
  badge: {
    paddingVertical: parseInt(spacing.xs),
    paddingHorizontal: parseInt(spacing.sm),
    borderRadius: parseInt(borderRadius.full),
    borderWidth: 1
  },
  badgeSuccess: {
    backgroundColor: colors.semantic.successLight,
    borderColor: colors.semantic.successBorder
  },
  badgeError: {
    backgroundColor: colors.semantic.errorLight,
    borderColor: colors.semantic.errorBorder
  },
  badgeWarning: {
    backgroundColor: colors.semantic.warningLight,
    borderColor: colors.semantic.warningBorder
  },
  badgeInfo: {
    backgroundColor: colors.semantic.infoLight,
    borderColor: colors.semantic.infoBorder
  },
  badgeAi: {
    backgroundColor: colors.semantic.aiLight,
    borderColor: colors.semantic.aiBorder
  },
  badgeText: {
    fontSize: parseInt(fontSize.xs),
    fontWeight: fontWeight.medium,
    textTransform: 'uppercase'
  },
  badgeTextSuccess: {
    color: colors.semantic.success
  },
  badgeTextError: {
    color: colors.semantic.error
  },
  badgeTextWarning: {
    color: colors.semantic.warning
  },
  badgeTextInfo: {
    color: colors.semantic.info
  },
  badgeTextAi: {
    color: colors.semantic.ai
  },

  // 输入框
  input: {
    padding: parseInt(spacing.sm),
    fontSize: parseInt(fontSize.base),
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: parseInt(borderRadius.md),
    backgroundColor: colors.background.primary,
    color: colors.text.primary,
    marginBottom: parseInt(spacing.sm)
  },

  // 颜色色板
  colorPalette: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: parseInt(spacing.base)
  },
  colorSwatch: {
    width: 150,
    borderRadius: parseInt(borderRadius.md),
    overflow: 'hidden',
    backgroundColor: colors.background.secondary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2
  },
  colorPreview: {
    height: 80
  },
  colorName: {
    fontSize: parseInt(fontSize.sm),
    fontWeight: fontWeight.medium,
    color: colors.text.primary,
    padding: parseInt(spacing.sm),
    paddingBottom: parseInt(spacing.xs)
  },
  colorValue: {
    fontSize: parseInt(fontSize.xs),
    color: colors.text.tertiary,
    paddingHorizontal: parseInt(spacing.sm),
    paddingBottom: parseInt(spacing.sm)
  }
})

export default App
