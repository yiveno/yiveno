// Custom Stylelint rule to block geometry-changing properties inside :hover/:focus/:active selectors
// Allowed changes should be non-geometric like color, background, opacity, outline, box-shadow, text-decoration

import stylelint from "stylelint";

const ruleName = "acuity/no-motion-on-interaction";
const messages = stylelint.utils.ruleMessages(ruleName, {
  rejected: (prop, selector) => `Disallowed property "${prop}" in interaction selector "${selector}". Avoid geometric changes on :hover/:focus/:active. Prefer color/opacity/shadow/outline.`,
  transitionAll: (selector) => `Disallowed \`transition: all\` in interaction selector "${selector}". Do not transition all properties; restrict to non-geometric (e.g., color, opacity, box-shadow).`,
  transitionPropAll: (selector) => `Disallowed \`transition-property: all\` in interaction selector "${selector}". Do not transition all properties; restrict to non-geometric ones.`,
});

const INTERACTION_PSEUDOS = [":hover", ":focus", ":focus-within", ":focus-visible", ":active"];

// Properties that cause layout/geometry changes or motion
const DISALLOWED_PROPS = new Set([
  // transforms
  "transform",
  "translate",
  "scale",
  "rotate",
  "transform-origin",
  // layout/box metrics
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "border",
  "border-top",
  "border-right",
  "border-bottom",
  "border-left",
  "border-width",
  "border-top-width",
  "border-right-width",
  "border-bottom-width",
  "border-left-width",
  "top",
  "right",
  "bottom",
  "left",
  "position",
  "inset",
  "height",
  "width",
  "min-height",
  "min-width",
  "max-height",
  "max-width",
  // filters that can cause sudden shape changes
  "filter",
]);

const plugin = stylelint.createPlugin(ruleName, function primary(on) {
  return function rule(root, result) {
    if (!on) return;

    const validOptions = stylelint.utils.validateOptions(result, ruleName, {});
    if (!validOptions) return;

    root.walkRules((ruleNode) => {
      const selector = ruleNode.selector || "";
      const hasInteraction = INTERACTION_PSEUDOS.some((p) => selector.includes(p));
      if (!hasInteraction) return;

      ruleNode.walkDecls((decl) => {
        const prop = decl.prop.toLowerCase();
        if (DISALLOWED_PROPS.has(prop)) {
          stylelint.utils.report({
            ruleName,
            result,
            node: decl,
            message: messages.rejected(prop, selector),
          });
        }
        if (prop === "transition") {
          // Audit transition properties: disallow transitioning geometry causing properties
          const value = (decl.value || "").toLowerCase();
          const badInTransition = [
            "all",
            ...Array.from(DISALLOWED_PROPS),
          ].some((p) => value.includes(p));
          if (badInTransition) {
            stylelint.utils.report({
              ruleName,
              result,
              node: decl,
              message: value.includes("all") ? messages.transitionAll(selector) : messages.rejected("transition of geometry", selector),
            });
          }
        }
        if (prop === "transition-property") {
          const value = (decl.value || "").toLowerCase();
          if (value.includes("all")) {
            stylelint.utils.report({
              ruleName,
              result,
              node: decl,
              message: messages.transitionPropAll(selector),
            });
          } else {
            // If transition-property includes unknown disallowed property names explicitly
            const hasBad = Array.from(DISALLOWED_PROPS).some((p) => value.includes(p));
            if (hasBad) {
              stylelint.utils.report({
                ruleName,
                result,
                node: decl,
                message: messages.rejected("transition-property of geometry", selector),
              });
            }
          }
        }
      });
    });
  };
});

plugin.ruleName = ruleName;
plugin.messages = messages;

export default plugin;
