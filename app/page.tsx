"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type BulletGroup = {
  id: string;
  title: string;
  bullets: string[];
};

type Experience = {
  id: string;
  company: string;
  role: string;
  location: string;
  dates: string;
  summary: string;
  groups: BulletGroup[];
};

type Education = {
  id: string;
  school: string;
  degree: string;
  dates: string;
  details: string[];
};

type Resume = {
  id: string;
  label: string;
  person: {
    name: string;
    headline: string;
    location: string;
    email: string;
    phone: string;
    links: string;
    profile: string;
  };
  experience: Experience[];
  education: Education[];
  style: {
    accent: string;
    bodySize: number;
    density: "tight" | "balanced" | "open";
  };
};

const STORAGE_KEY = "folio-resume-versions-v1";

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const createDefaultResume = (): Resume => ({
  id: "current-swe",
  label: "Current SWE",
  person: {
    name: "Zhiheng Liu",
    headline: "Software Engineer · Systems & AI",
    location: "Singapore",
    email: "zaynjarvis@gmail.com",
    phone: "+65 83099012",
    links: "",
    profile:
      "Software engineer building edge-cloud systems and LLM-based tools that improve audio-video experiences, system reliability, and engineering efficiency.",
  },
  experience: [
    {
      id: "tiktok",
      company: "TikTok Pte. Ltd",
      role: "Software Engineer · Multimedia Architecture",
      location: "Singapore",
      dates: "Aug 2021 - Present",
      summary:
        "Developed edge-cloud collaborative systems and LLM-based attribution solutions to optimize audio-video experiences and drive AI-powered efficiency improvements.",
      groups: [
        {
          id: "edge-cloud",
          title: "Edge-Cloud Collaboration Architecture",
          bullets: [
            "Led the Edge-Cloud Collaboration solution set, enabling bidirectional feature transmission and end-to-end video profile capabilities; improved active days by 0.037% and stay duration by 0.18%.",
            "Engineered a strategy orchestration system for real-time client-side execution and built a multi-experiment platform to reduce metric dilution and accelerate validation.",
          ],
        },
        {
          id: "llm-reasoning",
          title: "LLM-Driven Alarm Reasoning",
          bullets: [
            "Built an LLM-based fault attribution tool for automated alarm analysis and root-cause tracing through Eino and Fornax integration.",
            "Deployed an LLM-powered experiment analysis workflow supporting 10+ daily report-generation requests.",
            "Developed web tools for prompt testing and Mermaid diagram generation to support daily engineering workflows.",
          ],
        },
        {
          id: "systems",
          title: "Multimedia System Optimization",
          bullets: [
            "Led storage optimization efforts, reducing per-video storage costs by 90% and saving over 500 PB in one quarter; improved server throughput 10x through pprof-guided optimization.",
            "Developed P2P technology that reduced bandwidth costs by 0.05% in launched regions.",
            "Implemented an Upload Mini-Edge system to reduce upload latency and enhanced scheduling with real-time statistics.",
          ],
        },
        {
          id: "leadership",
          title: "Leadership & Impact",
          bullets: [
            "Mentored a junior engineer into a P2P project lead and an intern on an LLM-integration project; authored 10+ technical whitepapers with 2,000+ reads.",
            "Collaborated across client, algorithm, and server teams to standardize edge-cloud architecture and launch four major solutions.",
          ],
        },
      ],
    },
  ],
  education: [
    {
      id: "ntu",
      school: "Nanyang Technological University",
      degree: "B.Eng. in Electrical and Electronic Engineering",
      dates: "Aug 2017 - Jun 2021",
      details: [
        "SM2 Scholarship",
        "Dean's List 2018, 2019, 2021",
        "Highest Distinction · GPA 4.92/5.00",
      ],
    },
  ],
  style: {
    accent: "#B94F37",
    bodySize: 10.5,
    density: "balanced",
  },
});

const cloneResume = (resume: Resume): Resume => ({
  ...structuredClone(resume),
  id: newId(),
  label: `${resume.label} copy`,
});

function TextField({
  label,
  value,
  onChange,
  multiline = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={3}
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
      )}
    </label>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="resume-section-label">{children}</div>;
}

function isStoredResume(value: unknown): value is Resume {
  if (!value || typeof value !== "object") return false;
  const resume = value as Partial<Resume>;
  return Boolean(
    typeof resume.id === "string" &&
      typeof resume.label === "string" &&
      resume.person &&
      typeof resume.person.name === "string" &&
      typeof resume.person.profile === "string" &&
      Array.isArray(resume.experience) &&
      resume.experience.every(
        (item) =>
          item &&
          typeof item.company === "string" &&
          Array.isArray(item.groups) &&
          item.groups.every(
            (group) =>
              group &&
              typeof group.title === "string" &&
              Array.isArray(group.bullets) &&
              group.bullets.every((bullet) => typeof bullet === "string"),
          ),
      ) &&
      Array.isArray(resume.education) &&
      resume.style &&
      typeof resume.style.accent === "string" &&
      typeof resume.style.bodySize === "number",
  );
}

function isStoredResumeCollection(value: unknown): value is {
  versions: Resume[];
  activeId: string;
} {
  if (!value || typeof value !== "object") return false;
  const collection = value as { versions?: unknown; activeId?: unknown };
  return (
    Array.isArray(collection.versions) &&
    collection.versions.length > 0 &&
    collection.versions.every(isStoredResume) &&
    typeof collection.activeId === "string"
  );
}

export default function Home() {
  const [versions, setVersions] = useState<Resume[]>([createDefaultResume()]);
  const [activeId, setActiveId] = useState("current-swe");
  const [saveState, setSaveState] = useState<"saved" | "saving">("saved");
  const [hydrated, setHydrated] = useState(false);
  const [pageUse, setPageUse] = useState(0);
  const [editAuthorized, setEditAuthorized] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showUnlock, setShowUnlock] = useState(false);
  const [editKey, setEditKey] = useState("");
  const [unlockState, setUnlockState] = useState<"idle" | "checking" | "error">("idle");
  const previewContentRef = useRef<HTMLDivElement>(null);

  const active = useMemo(
    () => versions.find((version) => version.id === activeId) ?? versions[0],
    [activeId, versions],
  );

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed: unknown = JSON.parse(stored);
          if (isStoredResumeCollection(parsed)) {
            setVersions(parsed.versions);
            setActiveId(
              parsed.versions.some((item) => item.id === parsed.activeId)
                ? parsed.activeId
                : parsed.versions[0].id,
            );
          }
        }
      } catch {
        // A malformed local draft should never block the editor.
      } finally {
        setHydrated(true);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const wantsEdit = new URLSearchParams(window.location.search).has("edit");
    fetch("/api/edit-session", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { authorized: false }))
      .then((result: { authorized?: boolean }) => {
        const authorized = result.authorized === true;
        setEditAuthorized(authorized);
        if (wantsEdit && authorized) setEditing(true);
        if (wantsEdit && !authorized) setShowUnlock(true);
      })
      .catch(() => {
        if (wantsEdit) setShowUnlock(true);
      });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const frame = requestAnimationFrame(() => setSaveState("saving"));
    const timer = window.setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ versions, activeId }));
      setSaveState("saved");
    }, 350);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [activeId, hydrated, versions]);

  const measurePage = useCallback(() => {
    if (!previewContentRef.current) return;
    const used = Math.round(
      (previewContentRef.current.scrollHeight / 1003) * 100,
    );
    setPageUse(used);
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(measurePage);
    const observer = new ResizeObserver(measurePage);
    if (previewContentRef.current) observer.observe(previewContentRef.current);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [active, measurePage]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "e") {
        event.preventDefault();
        window.print();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const updateActive = (recipe: (draft: Resume) => void) => {
    setVersions((current) =>
      current.map((version) => {
        if (version.id !== active.id) return version;
        const next = structuredClone(version);
        recipe(next);
        return next;
      }),
    );
  };

  const updatePerson = (key: keyof Resume["person"], value: string) =>
    updateActive((draft) => {
      draft.person[key] = value;
    });

  const addVersion = () => {
    const next = cloneResume(active);
    setVersions((current) => [...current, next]);
    setActiveId(next.id);
  };

  const deleteVersion = () => {
    if (versions.length === 1) return;
    if (!window.confirm(`Delete “${active.label}”?`)) return;
    const remaining = versions.filter((version) => version.id !== active.id);
    setVersions(remaining);
    setActiveId(remaining[0].id);
  };

  const resetVersion = () => {
    if (!window.confirm("Reset this version to the original resume?")) return;
    const reset = createDefaultResume();
    reset.id = active.id;
    reset.label = active.label;
    setVersions((current) =>
      current.map((version) => (version.id === active.id ? reset : version)),
    );
  };

  const addExperience = () =>
    updateActive((draft) => {
      draft.experience.push({
        id: newId(),
        company: "New company",
        role: "Role",
        location: "Location",
        dates: "Dates",
        summary: "",
        groups: [
          { id: newId(), title: "Selected impact", bullets: ["New impact"] },
        ],
      });
    });

  const clearEditQuery = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("edit");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  };

  const closeUnlock = () => {
    setShowUnlock(false);
    setEditKey("");
    setUnlockState("idle");
    clearEditQuery();
  };

  const unlockEditing = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setUnlockState("checking");
    try {
      const response = await fetch("/api/edit-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: editKey }),
      });
      if (!response.ok) {
        setUnlockState("error");
        return;
      }
      setEditAuthorized(true);
      setEditing(true);
      setShowUnlock(false);
      setEditKey("");
      setUnlockState("idle");
      clearEditQuery();
    } catch {
      setUnlockState("error");
    }
  };

  const lockEditing = async () => {
    await fetch("/api/edit-session", { method: "DELETE" }).catch(() => undefined);
    setEditing(false);
    setEditAuthorized(false);
  };

  const pageCount = Math.max(1, Math.ceil(pageUse / 100));
  const fitTone = pageUse <= 96 ? "fit-good" : pageUse <= 100 ? "fit-close" : "fit-over";

  const pageStyle = {
    "--resume-accent": active.style.accent,
    "--resume-body-size": `${active.style.bodySize}px`,
    "--resume-gap":
      active.style.density === "tight"
        ? "12px"
        : active.style.density === "open"
          ? "24px"
          : "18px",
  } as CSSProperties;

  return (
    <main className={`app-shell ${editing ? "is-editing" : "is-public"}`}>
      <header className="topbar">
        {editing && (
          <div className="brand-block">
            <div className="brand-mark" aria-hidden="true">F</div>
            <div>
              <div className="brand-name">Folio</div>
              <div className="brand-note">Resume studio</div>
            </div>
          </div>
        )}

        {editing && (
          <div className="version-controls">
            <label className="sr-only" htmlFor="version-select">Resume version</label>
            <select
              id="version-select"
              value={active.id}
              onChange={(event) => setActiveId(event.target.value)}
            >
              {versions.map((version) => (
                <option key={version.id} value={version.id}>{version.label}</option>
              ))}
            </select>
            <button className="text-button" type="button" onClick={addVersion}>
              Duplicate version
            </button>
          </div>
        )}

        <div className="topbar-actions">
          {editing && (
            <>
              <span className={`fit-status ${fitTone}`}>
                <span className="status-dot" aria-hidden="true" />
                {pageCount === 1 ? `${pageUse || 0}% of A4` : `${pageCount} pages`}
              </span>
              <span className="save-status" role="status">
                {saveState === "saving" ? "Saving…" : "Saved on this device"}
              </span>
            </>
          )}
          {editAuthorized && (
            <button
              className="edit-mode-button"
              type="button"
              onClick={() => setEditing((current) => !current)}
            >
              {editing ? "Done editing" : "Edit resume"}
            </button>
          )}
          <button className="export-button" type="button" onClick={() => window.print()}>
            Export PDF
          </button>
        </div>
      </header>

      <div className="workspace">
        {editing && <aside className="editor-pane" aria-label="Resume editor">
          <div className="editor-heading">
            <div>
              <div className="eyebrow">Content</div>
              <h1>Shape the story.</h1>
            </div>
            <span className="local-pill">Private draft</span>
          </div>

          <section className="version-card">
            <TextField
              label="Version name"
              value={active.label}
              onChange={(value) => updateActive((draft) => { draft.label = value; })}
            />
            <p>Duplicate this version before tailoring it for a different role.</p>
          </section>

          <details open className="editor-section">
            <summary>
              <span><b>Personal details</b><small>Name, role and contact</small></span>
              <span className="summary-icon" aria-hidden="true">+</span>
            </summary>
            <div className="section-fields two-column">
              <TextField label="Full name" value={active.person.name} onChange={(v) => updatePerson("name", v)} />
              <TextField label="Location" value={active.person.location} onChange={(v) => updatePerson("location", v)} />
              <div className="full-width">
                <TextField label="Professional headline" value={active.person.headline} onChange={(v) => updatePerson("headline", v)} />
              </div>
              <TextField label="Email" value={active.person.email} onChange={(v) => updatePerson("email", v)} />
              <TextField label="Phone" value={active.person.phone} onChange={(v) => updatePerson("phone", v)} />
              <div className="full-width">
                <TextField label="Links" value={active.person.links} placeholder="LinkedIn · GitHub · Portfolio" onChange={(v) => updatePerson("links", v)} />
              </div>
              <div className="full-width">
                <TextField label="Profile statement" value={active.person.profile} multiline onChange={(v) => updatePerson("profile", v)} />
              </div>
            </div>
          </details>

          <details open className="editor-section">
            <summary>
              <span><b>Experience</b><small>{active.experience.length} role · editable impact stories</small></span>
              <span className="summary-icon" aria-hidden="true">+</span>
            </summary>
            <div className="section-fields stacked-cards">
              {active.experience.map((experience, experienceIndex) => (
                <article className="item-card" key={experience.id}>
                  <div className="item-card-heading">
                    <div><b>{experience.company || "Untitled role"}</b><small>{experience.role}</small></div>
                    {active.experience.length > 1 && (
                      <button
                        className="icon-text-button"
                        type="button"
                        onClick={() => updateActive((draft) => { draft.experience.splice(experienceIndex, 1); })}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="two-column">
                    <TextField label="Company" value={experience.company} onChange={(v) => updateActive((draft) => { draft.experience[experienceIndex].company = v; })} />
                    <TextField label="Dates" value={experience.dates} onChange={(v) => updateActive((draft) => { draft.experience[experienceIndex].dates = v; })} />
                    <TextField label="Role" value={experience.role} onChange={(v) => updateActive((draft) => { draft.experience[experienceIndex].role = v; })} />
                    <TextField label="Location" value={experience.location} onChange={(v) => updateActive((draft) => { draft.experience[experienceIndex].location = v; })} />
                    <div className="full-width">
                      <TextField label="Role summary" value={experience.summary} multiline onChange={(v) => updateActive((draft) => { draft.experience[experienceIndex].summary = v; })} />
                    </div>
                  </div>

                  <div className="story-list">
                    {experience.groups.map((group, groupIndex) => (
                      <div className="story-card" key={group.id}>
                        <div className="story-title-row">
                          <input
                            aria-label="Impact story title"
                            value={group.title}
                            onChange={(event) => updateActive((draft) => { draft.experience[experienceIndex].groups[groupIndex].title = event.target.value; })}
                          />
                          <button
                            type="button"
                            aria-label={`Remove ${group.title}`}
                            onClick={() => updateActive((draft) => { draft.experience[experienceIndex].groups.splice(groupIndex, 1); })}
                          >
                            ×
                          </button>
                        </div>
                        {group.bullets.map((bullet, bulletIndex) => (
                          <div className="bullet-editor" key={`${group.id}-${bulletIndex}`}>
                            <span aria-hidden="true">{String(bulletIndex + 1).padStart(2, "0")}</span>
                            <textarea
                              aria-label={`${group.title} bullet ${bulletIndex + 1}`}
                              rows={3}
                              value={bullet}
                              onChange={(event) => updateActive((draft) => { draft.experience[experienceIndex].groups[groupIndex].bullets[bulletIndex] = event.target.value; })}
                            />
                            <button
                              type="button"
                              aria-label={`Remove bullet ${bulletIndex + 1}`}
                              onClick={() => updateActive((draft) => { draft.experience[experienceIndex].groups[groupIndex].bullets.splice(bulletIndex, 1); })}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <button
                          className="add-row-button"
                          type="button"
                          onClick={() => updateActive((draft) => { draft.experience[experienceIndex].groups[groupIndex].bullets.push("New impact"); })}
                        >
                          + Add impact bullet
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    className="add-row-button full-width"
                    type="button"
                    onClick={() => updateActive((draft) => { draft.experience[experienceIndex].groups.push({ id: newId(), title: "New story", bullets: ["New impact"] }); })}
                  >
                    + Add impact story
                  </button>
                </article>
              ))}
              <button className="outline-button" type="button" onClick={addExperience}>+ Add another experience</button>
            </div>
          </details>

          <details className="editor-section">
            <summary>
              <span><b>Education</b><small>{active.education.length} entry</small></span>
              <span className="summary-icon" aria-hidden="true">+</span>
            </summary>
            <div className="section-fields stacked-cards">
              {active.education.map((education, educationIndex) => (
                <article className="item-card" key={education.id}>
                  <TextField label="School" value={education.school} onChange={(v) => updateActive((draft) => { draft.education[educationIndex].school = v; })} />
                  <TextField label="Degree" value={education.degree} onChange={(v) => updateActive((draft) => { draft.education[educationIndex].degree = v; })} />
                  <TextField label="Dates" value={education.dates} onChange={(v) => updateActive((draft) => { draft.education[educationIndex].dates = v; })} />
                  <TextField
                    label="Details · one per line"
                    value={education.details.join("\n")}
                    multiline
                    onChange={(v) => updateActive((draft) => { draft.education[educationIndex].details = v.split("\n"); })}
                  />
                </article>
              ))}
            </div>
          </details>

          <details open className="editor-section">
            <summary>
              <span><b>Page style</b><small>Typography and rhythm</small></span>
              <span className="summary-icon" aria-hidden="true">+</span>
            </summary>
            <div className="section-fields style-controls">
              <fieldset>
                <legend>Accent</legend>
                <div className="swatches">
                  {["#B94F37", "#315B52", "#315D86", "#73526D"].map((color) => (
                    <button
                      key={color}
                      type="button"
                      aria-label={`Use accent ${color}`}
                      aria-pressed={active.style.accent === color}
                      style={{ backgroundColor: color }}
                      onClick={() => updateActive((draft) => { draft.style.accent = color; })}
                    />
                  ))}
                </div>
              </fieldset>
              <label className="range-control">
                <span>Body size <b>{active.style.bodySize.toFixed(1)} pt</b></span>
                <input
                  type="range"
                  min="9"
                  max="12"
                  step="0.5"
                  value={active.style.bodySize}
                  onChange={(event) => updateActive((draft) => { draft.style.bodySize = Number(event.target.value); })}
                />
              </label>
              <fieldset>
                <legend>Page rhythm</legend>
                <div className="segmented-control">
                  {(["tight", "balanced", "open"] as const).map((density) => (
                    <button
                      key={density}
                      type="button"
                      aria-pressed={active.style.density === density}
                      onClick={() => updateActive((draft) => { draft.style.density = density; })}
                    >
                      {density[0].toUpperCase() + density.slice(1)}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
          </details>

          <div className="editor-footer-actions">
            <button className="text-button danger" type="button" onClick={deleteVersion} disabled={versions.length === 1}>Delete version</button>
            <button className="text-button" type="button" onClick={resetVersion}>Reset current version</button>
            <button className="text-button" type="button" onClick={lockEditing}>Lock editor</button>
          </div>
        </aside>}

        <section className="preview-pane" aria-label="Resume preview">
          {editing && <div className="preview-toolbar">
            <div>
              <span className="eyebrow">Live preview</span>
              <span>A4 · {pageCount === 1 ? "one page" : `${pageCount} pages`}</span>
            </div>
            <div className={`fit-explainer ${fitTone}`}>
              <span className="status-dot" aria-hidden="true" />
              {pageUse <= 96
                ? "Comfortable page fit"
                : pageUse <= 100
                  ? "Close to the page edge"
                  : "Reduce copy or type size"}
            </div>
          </div>}

          <div className="paper-stage">
            <article className="resume-page" style={pageStyle}>
              <div className="resume-page-inner" ref={previewContentRef}>
                <header className="resume-header">
                  <div>
                    <h2>{active.person.name || "Your name"}</h2>
                    <div className="resume-headline">{active.person.headline}</div>
                  </div>
                  <div className="resume-contact">
                    {active.person.location && <span>{active.person.location}</span>}
                    {active.person.email && <span>{active.person.email}</span>}
                    {active.person.phone && <span>{active.person.phone}</span>}
                    {active.person.links && <span>{active.person.links}</span>}
                  </div>
                </header>

                <div className="resume-rule"><span /></div>

                {active.person.profile && (
                  <section className="resume-section resume-profile-section">
                    <SectionLabel>Profile</SectionLabel>
                    <p>{active.person.profile}</p>
                  </section>
                )}

                <section className="resume-section">
                  <SectionLabel>Experience</SectionLabel>
                  <div className="resume-section-content">
                    {active.experience.map((experience) => (
                      <article className="resume-role" key={experience.id}>
                        <div className="resume-role-heading">
                          <div>
                            <h3>{experience.company}</h3>
                            <span>{experience.role}</span>
                          </div>
                          <div className="resume-role-meta">
                            <span>{experience.location}</span>
                            <span>{experience.dates}</span>
                          </div>
                        </div>
                        {experience.summary && <p className="role-summary">{experience.summary}</p>}
                        {experience.groups.map((group) => (
                          <div className="resume-story" key={group.id}>
                            <h4>{group.title}</h4>
                            <ul>
                              {group.bullets.filter(Boolean).map((bullet, index) => <li key={`${group.id}-${index}`}>{bullet}</li>)}
                            </ul>
                          </div>
                        ))}
                      </article>
                    ))}
                  </div>
                </section>

                <section className="resume-section">
                  <SectionLabel>Education</SectionLabel>
                  <div className="resume-section-content">
                    {active.education.map((education) => (
                      <article className="resume-education" key={education.id}>
                        <div>
                          <h3>{education.school}</h3>
                          <p>{education.degree}</p>
                          <p>{education.details.filter(Boolean).join(" · ")}</p>
                        </div>
                        <span>{education.dates}</span>
                      </article>
                    ))}
                  </div>
                </section>
              </div>
            </article>
          </div>
        </section>
      </div>
      {showUnlock && (
        <div className="unlock-backdrop" role="presentation">
          <section className="unlock-dialog" role="dialog" aria-modal="true" aria-labelledby="unlock-title">
            <button className="unlock-close" type="button" onClick={closeUnlock} aria-label="Close">×</button>
            <span className="eyebrow">Private edit mode</span>
            <h2 id="unlock-title">Unlock the editor</h2>
            <p>The deployed resume stays public. Edits are saved only in this browser.</p>
            <form onSubmit={unlockEditing}>
              <label className="field">
                <span>Edit key</span>
                <input
                  autoFocus
                  type="password"
                  autoComplete="current-password"
                  value={editKey}
                  onChange={(event) => {
                    setEditKey(event.target.value);
                    if (unlockState === "error") setUnlockState("idle");
                  }}
                />
              </label>
              {unlockState === "error" && <p className="unlock-error" role="alert">That key did not match.</p>}
              <button className="export-button" type="submit" disabled={!editKey || unlockState === "checking"}>
                {unlockState === "checking" ? "Checking…" : "Unlock editing"}
              </button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
