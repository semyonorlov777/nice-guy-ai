interface HowItWorksSectionProps {
  label: string;
  title: string;
  steps: { type: "chat" | "exercise" | "insight" | "portrait"; title: string }[];
  summary_text: string;
}

function StepPreview({ type }: { type: string }) {
  switch (type) {
    case "chat":
      return (
        <>
          <div className="bshape user">
            <div className="line w80"></div>
            <div className="line w50"></div>
          </div>
          <div className="bshape ai">
            <div className="ai-dot"></div>
            <div className="line w80"></div>
            <div className="line w70"></div>
            <div className="line w45 accent"></div>
          </div>
        </>
      );
    case "exercise":
      return (
        <>
          <div className="bshape ai">
            <div className="ai-dot"></div>
            <div className="line w80"></div>
            <div className="line w60"></div>
          </div>
          <div className="chips-row">
            <div className="chip-shape"><div className="line w60 accent"></div></div>
            <div className="chip-shape"><div className="line w50 accent"></div></div>
            <div className="chip-shape"><div className="line w45 accent"></div></div>
          </div>
        </>
      );
    case "insight":
      return (
        <div className="insight-shape">
          <div className="insight-icon">&#x1F4A1;</div>
          <div className="line w80 accent"></div>
          <div className="line w70"></div>
          <div className="line w60"></div>
        </div>
      );
    case "portrait":
      return (
        <div className="portrait-bars">
          <div className="portrait-col">
            <div className="portrait-col-label">&#1054;&#1076;&#1086;&#1073;&#1088;.</div>
            <div className="bar-track"><div className="bar-fill h78"></div></div>
          </div>
          <div className="portrait-col">
            <div className="portrait-col-label">&#1043;&#1088;&#1072;&#1085;.</div>
            <div className="bar-track"><div className="bar-fill h45"></div></div>
          </div>
          <div className="portrait-col">
            <div className="portrait-col-label">&#1050;&#1086;&#1085;&#1090;&#1088;.</div>
            <div className="bar-track"><div className="bar-fill h60"></div></div>
          </div>
          <div className="portrait-col">
            <div className="portrait-col-label">&#1048;&#1079;&#1086;&#1083;.</div>
            <div className="bar-track"><div className="bar-fill h25"></div></div>
          </div>
        </div>
      );
    default:
      return null;
  }
}

export function HowItWorksSection({ label, title, steps, summary_text }: HowItWorksSectionProps) {
  const firstRow = steps.slice(0, 2);
  const secondRow = steps.slice(2, 4);

  return (
    <section className="howitworks">
      <div className="content-w">
        <p className="section-label">{label}</p>
        <h2 dangerouslySetInnerHTML={{ __html: title }} />

        <div className="steps-grid">
          {firstRow.map((step, i) => (
            <div key={i} className="step-card">
              <div className="step-ui">
                <StepPreview type={step.type} />
              </div>
              <div className="step-label-row">
                <div className="step-num">{i + 1}</div>
                <div className="step-title">{step.title}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="steps-arrow">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
        </div>

        <div className="steps-grid">
          {secondRow.map((step, i) => (
            <div key={i} className="step-card">
              <div className="step-ui">
                <StepPreview type={step.type} />
              </div>
              <div className="step-label-row">
                <div className="step-num">{i + 3}</div>
                <div className="step-title">{step.title}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="summary">
          <div className="summary-flow">
            <div className="summary-step"><span className="s-icon">&#x1F4AC;</span> Разговор</div>
            <span className="summary-arrow">&rarr;</span>
            <div className="summary-step"><span className="s-icon">&#x270D;&#xFE0F;</span> Упражнение</div>
            <span className="summary-arrow">&rarr;</span>
            <div className="summary-step"><span className="s-icon">&#x1F4A1;</span> Инсайт</div>
            <span className="summary-arrow">&rarr;</span>
            <div className="summary-step"><span className="s-icon">&#x1FA9E;</span> Портрет</div>
          </div>
          <div className="summary-text" dangerouslySetInnerHTML={{ __html: summary_text }} />
        </div>
      </div>
    </section>
  );
}
