/**
 * AcuityBookmarks Design Tokens - Flutter 示例
 * 
 * 展示如何在 Flutter 项目中使用设计 tokens
 * 
 * 注意：这是一个示例文件，实际使用时需要创建独立的 Flutter package
 */

import 'package:flutter/material.dart';

// ============================================
// Design Tokens 定义
// ============================================

/// 颜色系统
class AcuityColors {
  // 品牌色
  static const Color brandPrimary = Color(0xFF3B82F6);
  static const Color brandPrimaryDark = Color(0xFF1E40AF);
  static const Color brandSecondary = Color(0xFFC026D3);
  static const Color brandSecondaryDark = Color(0xFF86198F);

  // 语义化颜色
  static const Color semanticSuccess = Color(0xFF22C55E);
  static const Color semanticError = Color(0xFFEF4444);
  static const Color semanticWarning = Color(0xFFF59E0B);
  static const Color semanticInfo = Color(0xFF3B82F6);
  static const Color semanticAi = Color(0xFFC026D3);

  // 中性色
  static const Color neutralWhite = Color(0xFFFFFFFF);
  static const Color neutralBlack = Color(0xFF000000);
  static const Color neutralGray50 = Color(0xFFF9FAFB);
  static const Color neutralGray100 = Color(0xFFF3F4F6);
  static const Color neutralGray200 = Color(0xFFE5E7EB);
  static const Color neutralGray300 = Color(0xFFD1D5DB);
  static const Color neutralGray400 = Color(0xFF9CA3AF);
  static const Color neutralGray500 = Color(0xFF6B7280);
  static const Color neutralGray600 = Color(0xFF4B5563);
  static const Color neutralGray700 = Color(0xFF374151);
  static const Color neutralGray800 = Color(0xFF1F2937);
  static const Color neutralGray900 = Color(0xFF111827);

  // 文本颜色
  static const Color textPrimary = Color(0xFF1F2937);
  static const Color textSecondary = Color(0xFF6B7280);
  static const Color textTertiary = Color(0xFF9CA3AF);
  static const Color textDisabled = Color(0xFFD1D5DB);
  static const Color textInverse = Color(0xFFFFFFFF);

  // 边框颜色
  static const Color borderDefault = Color(0xFFE5E7EB);
  static const Color borderLight = Color(0xFFF3F4F6);
  static const Color borderStrong = Color(0xFFD1D5DB);
  static const Color borderFocus = Color(0xFF3B82F6);

  // 背景颜色
  static const Color backgroundPrimary = Color(0xFFFFFFFF);
  static const Color backgroundSecondary = Color(0xFFF9FAFB);
  static const Color backgroundTertiary = Color(0xFFF3F4F6);
}

/// 间距系统
class AcuitySpacing {
  static const double none = 0;
  static const double xs = 4.0;
  static const double sm = 8.0;
  static const double md = 12.0;
  static const double base = 16.0;
  static const double lg = 24.0;
  static const double xl = 32.0;
  static const double xxl = 48.0;
  static const double xxxl = 64.0;
}

/// 圆角系统
class AcuityBorderRadius {
  static const double none = 0;
  static const double xs = 2.0;
  static const double sm = 4.0;
  static const double md = 8.0;
  static const double lg = 12.0;
  static const double xl = 16.0;
  static const double xxl = 24.0;
  static const double full = 9999.0;
}

/// 字体系统
class AcuityFontSize {
  static const double xs = 10.0;
  static const double sm = 12.0;
  static const double base = 14.0;
  static const double md = 16.0;
  static const double lg = 18.0;
  static const double xl = 20.0;
  static const double xxl = 24.0;
  static const double xxxl = 30.0;
  static const double xxxxl = 36.0;
  static const double xxxxxl = 48.0;
}

class AcuityFontWeight {
  static const FontWeight light = FontWeight.w300;
  static const FontWeight normal = FontWeight.w400;
  static const FontWeight medium = FontWeight.w500;
  static const FontWeight semibold = FontWeight.w600;
  static const FontWeight bold = FontWeight.w700;
  static const FontWeight extrabold = FontWeight.w800;
}

class AcuityLineHeight {
  static const double tight = 1.25;
  static const double snug = 1.375;
  static const double normal = 1.5;
  static const double relaxed = 1.625;
  static const double loose = 2.0;
}

// ============================================
// 按钮组件
// ============================================

enum ButtonVariant { primary, secondary, outline }

class AcuityButton extends StatelessWidget {
  final String text;
  final ButtonVariant variant;
  final VoidCallback? onPressed;

  const AcuityButton({
    Key? key,
    required this.text,
    this.variant = ButtonVariant.primary,
    this.onPressed,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    Color backgroundColor;
    Color textColor;
    Border? border;

    switch (variant) {
      case ButtonVariant.primary:
        backgroundColor = AcuityColors.brandPrimary;
        textColor = AcuityColors.neutralWhite;
        border = null;
        break;
      case ButtonVariant.secondary:
        backgroundColor = AcuityColors.brandSecondary;
        textColor = AcuityColors.neutralWhite;
        border = null;
        break;
      case ButtonVariant.outline:
        backgroundColor = Colors.transparent;
        textColor = AcuityColors.brandPrimary;
        border = Border.all(color: AcuityColors.brandPrimary, width: 2);
        break;
    }

    return ElevatedButton(
      onPressed: onPressed,
      style: ElevatedButton.styleFrom(
        backgroundColor: backgroundColor,
        foregroundColor: textColor,
        padding: const EdgeInsets.symmetric(
          vertical: AcuitySpacing.md,
          horizontal: AcuitySpacing.base,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AcuityBorderRadius.md),
          side: border?.top ?? BorderSide.none,
        ),
        elevation: 2,
      ),
      child: Text(
        text,
        style: const TextStyle(
          fontSize: AcuityFontSize.sm,
          fontWeight: AcuityFontWeight.medium,
        ),
      ),
    );
  }
}

// ============================================
// 卡片组件
// ============================================

class AcuityCard extends StatelessWidget {
  final String title;
  final String description;

  const AcuityCard({
    Key? key,
    required this.title,
    required this.description,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AcuitySpacing.base),
      margin: const EdgeInsets.only(bottom: AcuitySpacing.base),
      decoration: BoxDecoration(
        color: AcuityColors.backgroundSecondary,
        borderRadius: BorderRadius.circular(AcuityBorderRadius.lg),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.06),
            offset: const Offset(0, 2),
            blurRadius: 4,
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: AcuityFontSize.lg,
              fontWeight: AcuityFontWeight.semibold,
              color: AcuityColors.textPrimary,
            ),
          ),
          const SizedBox(height: AcuitySpacing.sm),
          Text(
            description,
            style: const TextStyle(
              fontSize: AcuityFontSize.base,
              height: AcuityLineHeight.normal,
              color: AcuityColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}

// ============================================
// 徽章组件
// ============================================

enum BadgeVariant { success, error, warning, info, ai }

class AcuityBadge extends StatelessWidget {
  final String text;
  final BadgeVariant variant;

  const AcuityBadge({
    Key? key,
    required this.text,
    this.variant = BadgeVariant.info,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    Color backgroundColor;
    Color textColor;
    Color borderColor;

    switch (variant) {
      case BadgeVariant.success:
        backgroundColor = AcuityColors.semanticSuccess.withOpacity(0.1);
        textColor = AcuityColors.semanticSuccess;
        borderColor = AcuityColors.semanticSuccess.withOpacity(0.5);
        break;
      case BadgeVariant.error:
        backgroundColor = AcuityColors.semanticError.withOpacity(0.1);
        textColor = AcuityColors.semanticError;
        borderColor = AcuityColors.semanticError.withOpacity(0.5);
        break;
      case BadgeVariant.warning:
        backgroundColor = AcuityColors.semanticWarning.withOpacity(0.1);
        textColor = AcuityColors.semanticWarning;
        borderColor = AcuityColors.semanticWarning.withOpacity(0.5);
        break;
      case BadgeVariant.info:
        backgroundColor = AcuityColors.semanticInfo.withOpacity(0.1);
        textColor = AcuityColors.semanticInfo;
        borderColor = AcuityColors.semanticInfo.withOpacity(0.5);
        break;
      case BadgeVariant.ai:
        backgroundColor = AcuityColors.semanticAi.withOpacity(0.1);
        textColor = AcuityColors.semanticAi;
        borderColor = AcuityColors.semanticAi.withOpacity(0.5);
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(
        vertical: AcuitySpacing.xs,
        horizontal: AcuitySpacing.sm,
      ),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(AcuityBorderRadius.full),
        border: Border.all(color: borderColor),
      ),
      child: Text(
        text.toUpperCase(),
        style: TextStyle(
          fontSize: AcuityFontSize.xs,
          fontWeight: AcuityFontWeight.medium,
          color: textColor,
          letterSpacing: 0.5,
        ),
      ),
    );
  }
}

// ============================================
// 主应用
// ============================================

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'AcuityBookmarks Design Tokens',
      theme: ThemeData(
        primaryColor: AcuityColors.brandPrimary,
        scaffoldBackgroundColor: AcuityColors.backgroundPrimary,
      ),
      home: const HomePage(),
    );
  }
}

class HomePage extends StatelessWidget {
  const HomePage({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('🎨 AcuityBookmarks Design Tokens'),
        backgroundColor: AcuityColors.brandPrimary,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(AcuitySpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 标题
            const Text(
              '这是一个 Flutter 示例，展示了如何使用设计系统。',
              style: TextStyle(
                fontSize: AcuityFontSize.base,
                color: AcuityColors.textSecondary,
              ),
            ),
            const SizedBox(height: AcuitySpacing.xl),

            // 按钮示例
            const Text(
              '按钮（Buttons）',
              style: TextStyle(
                fontSize: AcuityFontSize.xl,
                fontWeight: AcuityFontWeight.semibold,
                color: AcuityColors.textPrimary,
              ),
            ),
            const SizedBox(height: AcuitySpacing.base),
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                AcuityButton(
                  text: 'Primary Button',
                  variant: ButtonVariant.primary,
                  onPressed: () {},
                ),
                const SizedBox(height: AcuitySpacing.sm),
                AcuityButton(
                  text: 'Secondary Button',
                  variant: ButtonVariant.secondary,
                  onPressed: () {},
                ),
                const SizedBox(height: AcuitySpacing.sm),
                AcuityButton(
                  text: 'Outline Button',
                  variant: ButtonVariant.outline,
                  onPressed: () {},
                ),
              ],
            ),
            const SizedBox(height: AcuitySpacing.xl),

            // 卡片示例
            const Text(
              '卡片（Cards）',
              style: TextStyle(
                fontSize: AcuityFontSize.xl,
                fontWeight: AcuityFontWeight.semibold,
                color: AcuityColors.textPrimary,
              ),
            ),
            const SizedBox(height: AcuitySpacing.base),
            const AcuityCard(
              title: '卡片标题 1',
              description: '这是一个使用 Material Design 3 设计系统的卡片组件示例。',
            ),
            const AcuityCard(
              title: '卡片标题 2',
              description: '所有间距、颜色、圆角都使用设计 tokens。',
            ),
            const AcuityCard(
              title: '卡片标题 3',
              description: '确保在所有平台上保持一致的视觉效果。',
            ),
            const SizedBox(height: AcuitySpacing.xl),

            // 徽章示例
            const Text(
              '徽章（Badges）',
              style: TextStyle(
                fontSize: AcuityFontSize.xl,
                fontWeight: AcuityFontWeight.semibold,
                color: AcuityColors.textPrimary,
              ),
            ),
            const SizedBox(height: AcuitySpacing.base),
            Wrap(
              spacing: AcuitySpacing.sm,
              runSpacing: AcuitySpacing.sm,
              children: const [
                AcuityBadge(text: 'Success', variant: BadgeVariant.success),
                AcuityBadge(text: 'Error', variant: BadgeVariant.error),
                AcuityBadge(text: 'Warning', variant: BadgeVariant.warning),
                AcuityBadge(text: 'Info', variant: BadgeVariant.info),
                AcuityBadge(text: 'AI Feature', variant: BadgeVariant.ai),
              ],
            ),
            const SizedBox(height: AcuitySpacing.xl),

            // 输入框示例
            const Text(
              '输入框（Inputs）',
              style: TextStyle(
                fontSize: AcuityFontSize.xl,
                fontWeight: AcuityFontWeight.semibold,
                color: AcuityColors.textPrimary,
              ),
            ),
            const SizedBox(height: AcuitySpacing.base),
            TextField(
              decoration: InputDecoration(
                hintText: '请输入文字...',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AcuityBorderRadius.md),
                  borderSide: const BorderSide(color: AcuityColors.borderDefault),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AcuityBorderRadius.md),
                  borderSide: const BorderSide(color: AcuityColors.borderFocus),
                ),
                contentPadding: const EdgeInsets.symmetric(
                  vertical: AcuitySpacing.sm,
                  horizontal: AcuitySpacing.md,
                ),
              ),
            ),
            const SizedBox(height: AcuitySpacing.sm),
            TextField(
              decoration: InputDecoration(
                hintText: '请输入邮箱...',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AcuityBorderRadius.md),
                  borderSide: const BorderSide(color: AcuityColors.borderDefault),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AcuityBorderRadius.md),
                  borderSide: const BorderSide(color: AcuityColors.borderFocus),
                ),
                contentPadding: const EdgeInsets.symmetric(
                  vertical: AcuitySpacing.sm,
                  horizontal: AcuitySpacing.md,
                ),
              ),
              keyboardType: TextInputType.emailAddress,
            ),
          ],
        ),
      ),
    );
  }
}
