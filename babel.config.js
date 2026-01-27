module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      [
        "module-resolver",
        {
          root: ["./"],
          alias: {
            "@": "./client",
            "@shared": "./shared",
          },
          extensions: [".ios.js", ".android.js", ".js", ".ts", ".tsx", ".json"],
        },
      ],
      "react-native-reanimated/plugin",
      function transformImportMeta({ types: t }) {
        return {
          visitor: {
            MetaProperty(path) {
              if (
                path.node.meta.name === "import" &&
                path.node.property.name === "meta"
              ) {
                const parent = path.parentPath;
                if (
                  parent.isMemberExpression() &&
                  t.isIdentifier(parent.node.property, { name: "env" })
                ) {
                  const grandParent = parent.parentPath;
                  if (
                    grandParent.isMemberExpression() &&
                    t.isIdentifier(grandParent.node.property, { name: "MODE" })
                  ) {
                    grandParent.replaceWith(
                      t.memberExpression(
                        t.memberExpression(
                          t.identifier("process"),
                          t.identifier("env")
                        ),
                        t.identifier("NODE_ENV")
                      )
                    );
                  } else if (grandParent.isConditionalExpression()) {
                    parent.replaceWith(
                      t.objectExpression([
                        t.objectProperty(
                          t.identifier("MODE"),
                          t.memberExpression(
                            t.memberExpression(
                              t.identifier("process"),
                              t.identifier("env")
                            ),
                            t.identifier("NODE_ENV")
                          )
                        ),
                      ])
                    );
                  } else {
                    parent.replaceWith(
                      t.objectExpression([
                        t.objectProperty(
                          t.identifier("MODE"),
                          t.memberExpression(
                            t.memberExpression(
                              t.identifier("process"),
                              t.identifier("env")
                            ),
                            t.identifier("NODE_ENV")
                          )
                        ),
                      ])
                    );
                  }
                }
              }
            },
          },
        };
      },
    ],
  };
};
