#!/bin/bash
TARGET="src/app/dashboard.ts"

if grep -q "const randomTexts =" "$TARGET"; then
  # Already has an array definition in 'const oldest =... ' replaced area or so -> use our new code using sed replacing the previous block!
  sed -i -e '/const randomTexts = /,/this\.funStat\.set(activeFunStat);/!b' -e '/this\.funStat\.set(activeFunStat);/!d' -e '/this\.funStat\.set(activeFunStat);/r '<(cat << 'EOF'
                        fetch('/app/ui/RANDOM_DASHBOARD-TEXTS.MD')
                            .then(res => res.text())
                            .then(text => {
                                const lines = text.split('\n')
                                    .map(line => line.trim())
                                    .filter(line => line && !line.startsWith('//') && line.length > 5);
                                    
                                if (lines.length > 0) {
                                    const cleanedLines = lines.map(l => l.replace(/^["„“']|["„“']$/g, ''));
                                    const activeFunStat = cleanedLines[Math.floor(Math.random() * cleanedLines.length)];
                                    this.funStat.set(activeFunStat);
                                }
                            })
                            .catch(err => {
                                this.funStat.set('Entdecke deine Familiengeschichte.');
                            });
EOF
  ) -e '/this\.funStat\.set(activeFunStat);/d' -e 'd' "$TARGET"
else
  # Use generic replace of Fun Stat section using the new loading algorithm
  echo "Random loader array string pattern not fully matched..."
fi
