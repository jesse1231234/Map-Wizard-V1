export type WizardResource =
  | { type: "image"; url: string; caption?: string }
  | { type: "video"; url: string; caption?: string }
  | { type: "link"; url: string; caption?: string }
  | { type: "embed"; url: string; caption?: string };

export type QuestionBase = {
  id: string;
  label: string;
  required?: boolean;
  help_text?: string;
};

export type Question =
  | (QuestionBase & { type: "short_text"; ui?: { placeholder?: string } })
  | (QuestionBase & { type: "long_text"; ui?: { placeholder?: string } })
  | (QuestionBase & {
      type: "single_select";
      options: Array<{ value: string; label: string }>;
    })
  | (QuestionBase & {
      type: "url";
      ui?: { placeholder?: string };
    })
  | (QuestionBase & {
      type: "file";
      ui?: { accept?: string[] };
    })
  | (QuestionBase & {
      type: "repeat_group";
      ui?: { min_items?: number; max_items?: number; add_label?: string };
      fields: Array<
        | { id: string; type: "short_text"; label: string; required?: boolean; ui?: { placeholder?: string } }
        | { id: string; type: "long_text"; label: string; required?: boolean; ui?: { placeholder?: string } }
        | {
            id: string;
            type: "single_select";
            label: string;
            required?: boolean;
            options: Array<{ value: string; label: string }>;
          }
        | { id: string; type: "url"; label: string; required?: boolean; ui?: { placeholder?: string } }
        | { id: string; type: "file"; label: string; required?: boolean; ui?: { accept?: string[] } }
      >;
    })
  | (QuestionBase & {
      type: "matrix";
      ui: { rows_from_answer: string; row_label_field: string };
      columns: Array<
        | { id: string; type: "short_text"; label: string; required?: boolean; ui?: { placeholder?: string } }
        | { id: string; type: "long_text"; label: string; required?: boolean; ui?: { placeholder?: string } }
      >;
    });

export type StepGate =
  | { mode: "none" }
  | { mode: "soft"; rubric_id?: string }
  | { mode: "hard"; rubric_id: string };

export type WizardStep = {
  id: string;
  title: string;
  gate: StepGate;
  content: {
    intro_md?: string;
    why_md?: string;
    resources?: WizardResource[];
  };
  questions: Question[];
};

export type WizardConfig = {
  wizard_id: string;
  version: number;
  title: string;
  steps: WizardStep[];
};

export const wizardConfigV1: WizardConfig = {
  wizard_id: "course_map_v1",
  version: 1,
  title: "Course Map Wizard",
  steps: [
    {
      id: "s0_context",
      title: "Course context",
      gate: { mode: "none" },
      content: {
        intro_md: "Capture basic context so later feedback is grounded.",
        why_md:
          "Instructional design decisions depend on audience, constraints, and delivery context.",
        resources: [
          {
            type: "link",
            url: "https://en.wikipedia.org/wiki/Instructional_design",
            caption: "Instructional design (overview)"
          }
        ]
      },
      questions: [
        {
          id: "course_title",
          type: "short_text",
          label: "Course title (working title)",
          required: true,
          ui: { placeholder: "e.g., Data Storytelling for Managers" }
        },
        {
          id: "audience",
          type: "long_text",
          label: "Who is this course for?",
          required: true,
          ui: { placeholder: "Describe roles, experience level, and motivation." }
        },
        {
          id: "delivery_modality",
          type: "single_select",
          label: "Delivery modality",
          required: true,
          options: [
            { value: "async", label: "Asynchronous online" },
            { value: "sync", label: "Synchronous online" },
            { value: "blended", label: "Blended" },
            { value: "in_person", label: "In-person" },
            { value: "unknown", label: "Not sure yet" }
          ]
        },
        {
          id: "constraints",
          type: "long_text",
          label: "Key constraints (tools, policies, time limits, accessibility, compliance)",
          required: false
        }
      ]
    },

    {
      id: "s1_outcomes",
      title: "Learning outcomes",
      gate: { mode: "hard", rubric_id: "r_outcomes_v1" },
      content: {
        intro_md: "Define what learners will be able to **do** after the course.",
        why_md:
          "Outcomes drive assessments and content. If outcomes are vague, everything downstream becomes guesswork.",
        resources: [
          {
            type: "video",
            url: "https://www.youtube.com/watch?v=7nqCG4iZCjY",
            caption: "Bloom’s Taxonomy (quick overview)"
          }
        ]
      },
      questions: [
        {
          id: "outcomes_list",
          type: "repeat_group",
          label: "Add 3–6 learning outcomes",
          required: true,
          ui: { min_items: 3, max_items: 6, add_label: "Add another outcome" },
          fields: [
            {
              id: "outcome_text",
              type: "short_text",
              label: "Outcome",
              required: true,
              ui: { placeholder: "e.g., Analyze churn data to recommend retention actions." }
            }
          ]
        },
        {
          id: "success_definition",
          type: "long_text",
          label:
            "What does success look like in the real world for someone who completes this course?",
          required: false
        }
      ]
    },

    {
      id: "s2_evidence",
      title: "Evidence of learning (assessments)",
      gate: { mode: "hard", rubric_id: "r_evidence_v1" },
      content: {
        intro_md: "For each outcome, define how you’d know a learner can do it.",
        why_md: "If you can’t assess it, you can’t be confident it was learned.",
        resources: [
          {
            type: "image",
            url: "https://upload.wikimedia.org/wikipedia/commons/0/0b/Constructive_alignment.png",
            caption: "Constructive alignment concept"
          }
        ]
      },
      questions: [
        {
          id: "evidence_map",
          type: "matrix",
          label: "Outcome → evidence",
          required: true,
          ui: { rows_from_answer: "s1_outcomes.outcomes_list", row_label_field: "outcome_text" },
          columns: [
            {
              id: "evidence",
              type: "long_text",
              label: "How could a learner demonstrate this outcome?",
              required: true,
              ui: { placeholder: "e.g., Submit a report; complete a scenario task; record a demo." }
            },
            {
              id: "criteria",
              type: "short_text",
              label: "What would you look for to judge it’s correct/good?",
              required: false,
              ui: { placeholder: "e.g., Accuracy ≥ 80%; includes 3 justified recommendations." }
            }
          ]
        }
      ]
    },

    {
      id: "s3_learners",
      title: "Learner profile and prerequisites",
      gate: { mode: "soft", rubric_id: "r_learners_v1" },
      content: {
        intro_md: "Describe what learners already know and what might trip them up.",
        why_md: "This prevents building content that’s too advanced—or too basic."
      },
      questions: [
        {
          id: "prereqs",
          type: "long_text",
          label: "What should learners already know or be able to do before starting?",
          required: false
        },
        {
          id: "common_mistakes",
          type: "long_text",
          label: "Common misconceptions or mistakes learners might make",
          required: false
        },
        {
          id: "accessibility_notes",
          type: "long_text",
          label: "Accessibility or accommodation considerations",
          required: false
        }
      ]
    },

    {
      id: "s4_materials",
      title: "Materials and content inventory",
      gate: { mode: "soft", rubric_id: "r_materials_v1" },
      content: {
        intro_md: "List or upload materials learners will need (or materials you already have).",
        why_md:
          "This helps the instructional designer reuse good content and identify gaps early."
      },
      questions: [
        {
          id: "materials_list",
          type: "repeat_group",
          label: "Materials (links, docs, videos, datasets, policies)",
          required: false,
          ui: { min_items: 0, max_items: 30, add_label: "Add a material" },
          fields: [
            {
              id: "material_type",
              type: "single_select",
              label: "Type",
              required: true,
              options: [
                { value: "link", label: "Link" },
                { value: "doc", label: "Document" },
                { value: "slides", label: "Slides" },
                { value: "video", label: "Video" },
                { value: "dataset", label: "Dataset" },
                { value: "other", label: "Other" }
              ]
            },
            {
              id: "description",
              type: "short_text",
              label: "What is it and why is it useful?",
              required: true
            },
            {
              id: "url",
              type: "url",
              label: "URL (if applicable)",
              required: false
            },
            {
              id: "file",
              type: "file",
              label: "Upload (if applicable)",
              required: false,
              ui: { accept: [".pdf", ".docx", ".pptx", ".txt", ".csv", ".xlsx"] }
            },
            {
              id: "requiredness",
              type: "single_select",
              label: "Required for learners?",
              required: true,
              options: [
                { value: "required", label: "Required" },
                { value: "optional", label: "Optional" },
                { value: "reference", label: "Reference" }
              ]
            }
          ]
        },
        {
          id: "no_materials_reason",
          type: "short_text",
          label: "If you have no materials yet, why?",
          required: false,
          ui: { placeholder: "e.g., New course; content will be developed from scratch." }
        }
      ]
    },

    {
      id: "s5_modules",
      title: "Module and lesson map",
      gate: { mode: "hard", rubric_id: "r_modules_v1" },
      content: {
        intro_md: "Organize outcomes into a coherent set of modules/lessons.",
        why_md: "Chunking makes learning manageable and ensures coverage of all outcomes."
      },
      questions: [
        {
          id: "module_draft",
          type: "long_text",
          label: "Propose a module outline (rough is fine)",
          required: true,
          ui: { placeholder: "Example:\nModule 1: ...\n- Lesson A: ...\nModule 2: ...\n..." }
        }
      ]
    },

    {
      id: "s6_practice",
      title: "Practice and learning activities",
      gate: { mode: "soft", rubric_id: "r_practice_v1" },
      content: {
        intro_md: "List how learners will practice the skills before final assessments.",
        why_md: "Practice is where most learning happens; content alone isn’t enough."
      },
      questions: [
        {
          id: "activities",
          type: "long_text",
          label:
            "What practice activities could support the outcomes? (labs, scenarios, discussions, drafts, etc.)",
          required: false
        }
      ]
    },

    {
      id: "s7_review",
      title: "Review and export",
      gate: { mode: "none" },
      content: {
        intro_md: "Review the course map draft. Export for an instructional designer.",
        why_md: "You’ll leave with a clear, actionable course map and a list of open questions."
      },
      questions: []
    }
  ]
};
