(() => {
  'use strict';
  if (globalThis.__jamieJobAutofill) return;
  let launcherObserver = null;
  let launcherRepairTimer = null;
  let destroyed = false;
  globalThis.__jamieJobAutofill = {
    destroy() {
      destroyed = true;
      launcherObserver?.disconnect();
      document.documentElement.removeAttribute('data-jk-collapsed');
      clearTimeout(launcherRepairTimer);
      ['jk-autofill-launcher', 'jk-autofill-now', 'jk-save-profile', 'jk-menu-toggle', 'jk-menu-close', 'jk-save-profile-host', 'jk-autofill-panel', 'jk-autofill-toast', 'jk-launcher-style', 'jk-panel-style', 'jk-review-host', 'jk-field-memory-button', 'jk-field-memory-menu']
        .forEach(id => document.getElementById(id)?.remove());
      delete globalThis.__jamieJobAutofill;
    }
  };
  const launcherStyle = document.createElement('style');
  launcherStyle.id = 'jk-launcher-style';
  launcherStyle.textContent = `
    #jk-autofill-launcher {position:fixed!important;right:18px!important;bottom:18px!important;
      z-index:2147483646!important;padding:12px 18px!important;border:0!important;border-radius:24px!important;
      background:#194e9e!important;color:#fff!important;font:600 14px system-ui,sans-serif!important;
      box-shadow:0 4px 18px #0003!important;cursor:pointer!important;}
    #jk-menu-toggle, #jk-menu-close {position:fixed!important;right:18px!important;bottom:174px!important;z-index:2147483646!important;
      width:28px!important;height:28px!important;min-width:0!important;padding:0!important;margin:0!important;border:2px solid #fff!important;
      border-radius:999px!important;background:#536078!important;color:#fff!important;box-shadow:0 2px 8px #0005!important;
      font:700 16px/1 system-ui,sans-serif!important;display:flex!important;align-items:center!important;
      justify-content:center!important;cursor:grab!important;touch-action:none!important;}
    #jk-menu-close {right:52px!important;cursor:pointer!important;background:#8a3b3b!important;}
    #jk-autofill-launcher, #jk-autofill-now, #jk-save-profile, #jk-menu-toggle, #jk-menu-close {
      transform:translate(var(--jk-dx,0px),var(--jk-dy,0px))!important;}
    html[data-jk-collapsed] #jk-autofill-launcher, html[data-jk-collapsed] #jk-autofill-now,
    html[data-jk-collapsed] #jk-save-profile {display:none!important;}
    html[data-jk-collapsed] #jk-menu-toggle {bottom:18px!important;}
    html[data-jk-collapsed] #jk-menu-close {display:none!important;}
    #jk-field-memory-button {position:fixed!important;z-index:2147483647!important;width:28px!important;height:28px!important;
      min-width:28px!important;min-height:28px!important;padding:0!important;margin:0!important;border:2px solid #fff!important;
      border-radius:999px!important;background:#194e9e!important;color:#fff!important;box-shadow:0 2px 8px #0005!important;
      font:700 16px/24px system-ui,sans-serif!important;text-align:center!important;cursor:pointer!important;display:none;}
    #jk-field-memory-button[data-saved="true"] {background:#2f7d45!important;}
    #jk-field-memory-menu {position:fixed!important;z-index:2147483647!important;width:210px!important;padding:8px!important;
      margin:0!important;background:#fff!important;color:#222!important;border:1px solid #cfcfcf!important;border-radius:10px!important;
      box-shadow:0 8px 28px #0004!important;font:13px system-ui,sans-serif!important;display:none;}
    #jk-field-memory-menu .jk-memory-title {font-weight:700!important;margin:2px 4px 7px!important;white-space:nowrap!important;
      overflow:hidden!important;text-overflow:ellipsis!important;}
    #jk-field-memory-menu button {display:block!important;width:100%!important;margin:4px 0!important;padding:8px 9px!important;
      border:1px solid #d7d7d7!important;border-radius:7px!important;background:#f7f7f7!important;color:#222!important;
      font:13px system-ui,sans-serif!important;text-align:left!important;cursor:pointer!important;}
    #jk-field-memory-menu button:hover {background:#ececec!important;}
    #jk-field-memory-menu button:disabled {opacity:.45!important;cursor:default!important;}
  `;
  (document.head || document.documentElement).appendChild(launcherStyle);

  const PROFILE = structuredClone(JAMIE_DEFAULTS.profile);
  const OPTIONAL = structuredClone(JAMIE_DEFAULTS.optional);
  /*
   * These are deliberately NOT auto-filled by general matching.
   * The explicitly configured veteran answer has a separate exact-match handler.
   */

  const SENSITIVE_TERMS = [
    'race',
    'ethnicity',
    'ethnic',
    'hispanic',
    'latino',
    'latina',
    'latinx',
    'gender',
    'sexual orientation',
    'veteran',
    'disability',
    'disabled',
    'religion',
    'marital',
    'pregnan',
    'date of birth',
    'birth date',
    'dob',
    'social security',
    'ssn',
    'medical',
    'pronoun',
    'citizenship status',
    'self identification',
    'self-identification',
    'voluntary self',
    'eeo'
  ];

  const normalize = (text) =>
    String(text || '')
      .toLowerCase()
      .replace(/\u00a0/g, ' ')
      .replace(/[_\-:/()[\],.?*]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  function elementRoot(el) {
    const root = el?.getRootNode?.();
    return root && typeof root.querySelectorAll === 'function' ? root : document;
  }

  function rootElementById(el, id) {
    const root = elementRoot(el);
    return root === document ? document.getElementById(id) : root.getElementById?.(id);
  }

  function isVisible(el) {
    if (!el || el.disabled || el.type === 'hidden' || el.matches(':disabled') ||
        el.closest('[aria-hidden="true"],[aria-disabled="true"],[inert]')) {
      return false;
    }

    const style = getComputedStyle(el);

    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      el.getClientRects().length > 0
    );
  }

  function getLabelText(el) {
    const pieces = [];

    if (el.labels) {
      [...el.labels].forEach((label) => {
        pieces.push(label.innerText || label.textContent || '');
      });
    }

    if (el.id) {
      try {
        elementRoot(el)
          .querySelectorAll(`label[for="${CSS.escape(el.id)}"]`)
          .forEach((label) => {
            pieces.push(label.innerText || label.textContent || '');
          });
      } catch (error) {}
    }

    const parentLabel = el.closest('label');

    if (parentLabel) {
      pieces.push(
        parentLabel.innerText ||
        parentLabel.textContent ||
        ''
      );
    }

    const labelledBy =
      el.getAttribute('aria-labelledby');

    if (labelledBy) {
      labelledBy.split(/\s+/).forEach((id) => {
        const node =
          rootElementById(el, id);

        if (node) {
          pieces.push(
            node.innerText ||
            node.textContent ||
            ''
          );
        }
      });
    }

    return pieces.join(' ');
  }

  function getDescriptor(el) {
    const container =
      el.closest(
        '[role="group"], fieldset, .form-group, .field, .question, .form-field, li, tr'
      );

    const context =
      container
        ? (
            container.innerText ||
            container.textContent ||
            ''
          ).slice(0, 500)
        : '';

    return normalize(
      [
        getLabelText(el),
        el.getAttribute('aria-label'),
        el.getAttribute('placeholder'),
        el.getAttribute('name'),
        el.getAttribute('id'),
        el.getAttribute('data-automation-id'),
        el.getAttribute('data-testid'),
        el.getAttribute('autocomplete'),
        context
      ]
        .filter(Boolean)
        .join(' | ')
    );
  }

  function isSensitive(desc) {
    return SENSITIVE_TERMS.some(
      (term) => desc.includes(term)
    );
  }

  function hasValue(el) {
    if (el instanceof HTMLSelectElement) {
      const selected = [...el.selectedOptions];
      return selected.some((option) => {
        const label = normalize(option.textContent).replace(/^[\s\u2013\u2014-]+|[\s\u2013\u2014-]+$/g, '');
        return option.value.trim() !== '' && !option.disabled &&
          !/^(?:(?:please )?(?:select|choose|pick)(?:\b.*)?|not selected|none selected)$/i.test(label);
      });
    }
    if (
      el.type === 'radio' ||
      el.type === 'checkbox'
    ) {
      return el.checked;
    }

    return String(
      el.value || ''
    ).trim() !== '';
  }

  function fireEvents(el) {
    [
      'input',
      'change',
      'blur'
    ].forEach((type) => {
      el.dispatchEvent(
        new Event(type, {
          bubbles: true
        })
      );
    });
  }

  function setValue(el, value) {
    if (
      value === null ||
      value === undefined ||
      String(value).trim() === ''
    ) {
      return false;
    }

    const str =
      String(value);

    if (
      el instanceof HTMLSelectElement
    ) {
      const wanted =
        normalize(str);

      const options =
        [...el.options].filter((o) => !o.disabled && !o.parentElement?.disabled && o.value.trim() !== '');

      let option =
        options.find(
          (o) =>
            normalize(o.value) === wanted ||
            normalize(o.textContent) === wanted
        );

      if (!option && ['mobile', 'linkedin', '40'].includes(wanted)) {
        const aliases = {
          mobile: ['mobile', 'mobile phone', 'cell', 'cell phone', 'cellular', 'cellular phone'],
          linkedin: ['linkedin', 'linked in'],
          '40': ['40', '40 hours', '40 hours per week', '40 hrs', '40 hrs per week']
        };
        option = options.find(o => [o.value, o.textContent].some(text =>
          aliases[wanted].includes(normalize(text))));
      }

      if (
        !option &&
        wanted === 'maryland'
      ) {
        option =
          options.find(
            (o) =>
              [
                'md',
                'maryland',
                'us md',
                'maryland md',
                'md maryland'
              ].includes(
                normalize(o.value)
              ) ||
              [
                'md',
                'maryland',
                'us md',
                'maryland md',
                'md maryland'
              ].includes(
                normalize(o.textContent)
              )
          );
      }

      if (
        !option &&
        wanted === 'united states'
      ) {
        option =
          options.find((o) => {
            const values = [
              normalize(o.value),
              normalize(o.textContent)
            ];

            return values.some(
              (value) =>
                [
                  'us',
                  'usa',
                  'united states',
                  'united states of america',
                  'united states us',
                  'united states usa',
                  'us united states',
                  'usa united states',
                  'united states of america usa',
                  'u s',
                  'u s a'
                ].includes(value)
            );
          });
      }

      if (
        !option &&
        wanted.includes('bachelor')
      ) {
        option =
          options.find(
            (o) =>
              normalize(
                o.textContent
              ).includes(
                'bachelor'
              )
          );
      }

      if (!option) {
        return false;
      }

      const selectSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
      if (selectSetter) selectSetter.call(el, option.value);
      else el.value = option.value;

      fireEvents(el);

      return el.value === option.value;
    }

    if (
      [
        'file',
        'radio',
        'checkbox'
      ].includes(el.type)
    ) {
      return false;
    }

    const proto =
      el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;

    const setter =
      Object.getOwnPropertyDescriptor(
        proto,
        'value'
      )?.set;

    try {
      if (setter) {
        setter.call(
          el,
          str
        );
      } else {
        el.value =
          str;
      }
    } catch (error) {
      el.value =
        str;
    }

    fireEvents(el);

    return true;
  }

  /*
   * FIELD MATCHING RULES
   */

  const phoneValue = () => PROFILE.phone;
  const RULES = [
    [
      () => PROFILE.phoneDeviceType,
      [/\bphone (?:device )?type\b/, /\btelephone type\b/, /\bdevice type\b/]
    ],
    [
      () => OPTIONAL.referralSource,
      [/\bhow did you hear\b/, /\bhow did you find\b/, /\breferral source\b/, /\bapplication source\b/]
    ],
    [
      () => PROFILE.firstName,
      [
        /\bfirst name\b/,
        /\bgiven name\b/,
        /\bfname\b/
      ],
      [
        /reference/,
        /manager/,
        /supervisor/
      ]
    ],

    [
      () => PROFILE.preferredName,
      [
        /\bpreferred.*name\b/,
        /\bnickname\b/
      ]
    ],

    [
      () => PROFILE.namePronunciation,
      [/\bname pronunciation\b/, /\bpronounce your name\b/]
    ],

    [
      () => PROFILE.lastName,
      [
        /\blast name\b/,
        /\bfamily name\b/,
        /\bsurname\b/,
        /\blname\b/
      ],
      [
        /reference/,
        /manager/,
        /supervisor/
      ]
    ],

    [
      () => PROFILE.fullName,
      [
        /\bfull name\b/,
        /\blegal name\b/,
        /\bcandidate name\b/,
        /\bapplicant name\b/,
        /^(?:your )?name$/
      ],
      [
        /company/,
        /employer/,
        /school/,
        /reference/
      ]
    ],

    [
      () => PROFILE.email,
      [
        /\be[\s-]?mail\b/,
        /\bemail address\b/
      ],
      [
        /reference/,
        /manager/,
        /supervisor/,
        /\b(?:phone|mobile|telephone|cell)\b/
      ]
    ],

    [
      phoneValue,
      [
        /\bphone\b/,
        /\bmobile\b/,
        /\btelephone\b/,
        /\bcell\b/
      ],
      [
        /reference/,
        /manager/,
        /supervisor/,
        /fax/,
        /\b(?:secondary|alternate|alternative|second)\b/  // the profile holds one phone number
      ]
    ],

    [
      () => PROFILE.city,
      [
        /\bcity\b/,
        /\blocality\b/
      ],
      [
        /company/,
        /employer/,
        /school/
      ]
    ],

    [
      () => PROFILE.state,
      [
        /\bstate\b/,
        /\bprovince\b/,
        /\bregion\b/
      ],
      [
        /statement/,
        /company/,
        /employer/,
        /school/
      ]
    ],

    [
      () => PROFILE.country,
      [
        /\bcountry\b/,
        /\bcountry of residence\b/
      ],
      [
        /citizenship/
      ]
    ],

    [
      () => OPTIONAL.streetAddress,
      [
        /\bstreet address\b/,
        /\baddress line 1\b/,
        /\baddress1\b/,
        /^address(?: 1)?$/
      ]
    ],

    [
      () => OPTIONAL.addressLine2,
      [
        /\baddress line 2\b/,
        /\baddress2\b/,
        /^address 2$/,
        /\bapt\b/,
        /\bsuite\b/
      ]
    ],

    [
      () => OPTIONAL.zipCode,
      [
        /\bzip\b/,
        /\bpostal\b/,
        /\bpostal code\b/
      ]
    ],

    [
      () => PROFILE.portfolio,
      [
        /\bportfolio\b/,
        /\bpersonal website\b/,
        /\bprofessional website\b/,
        /^(?:your |my )?(?:web ?site|website)(?: url| link| address)?$/
      ]
    ],

    [
      () => PROFILE.linkedin,
      [
        /\blinked ?in\b/,
        /\blinkedin\b/
      ]
    ],

    [
      () => OPTIONAL.github,
      [
        /\bgithub\b/
      ]
    ],

    [
      () => OPTIONAL.otherWebsite,
      [
        /\bother (website|url|link)\b/,
        /\badditional (website|url|link)\b/
      ]
    ],

    [
      () => PROFILE.professionalTitle,
      [
        /\bprofessional title\b/,
        /\bprofile title\b/,
        /\bheadline\b/
      ],
      [
        /\bjob title\b/,
        /\bcurrent title\b/
      ]
    ],

    [
      () => PROFILE.yearsExperience,
      [
        /\byears? of .*experience\b/,
        /\btotal years? experience\b/,
        /\byears? experience\b/
      ]
    ],

    [
      () => PROFILE.summary,
      [
        /\bprofessional summary\b/,
        /\bprofile summary\b/,
        /\bcareer summary\b/,
        /\babout you\b/
      ],
      [],
      true
    ],

    [
      () => OPTIONAL.coverLetter,
      [/^cover letter(?: text| message)?$/, /^application letter$/],
      [],
      true
    ],

    [
      () => PROFILE.skills,
      [
        /\btechnical skills\b/,
        /\bkey skills\b/,
        /\bskills\b/,
        /\btechnologies\b/
      ],
      [],
      true
    ],

    [
      () => PROFILE.language,
      [
        /\bprimary language\b/,
        /\blanguage\b/
      ],
      [
        /programming/,
        /coding/
      ]
    ],

    [
      () => PROFILE.highestEducation,
      [
        /\bhighest .*education\b/,
        /\beducation level\b/,
        /\bhighest degree\b/
      ]
    ],

    [
      () => OPTIONAL.desiredSalary,
      [
        /\bdesired salary\b/,
        /\bsalary expectation\b/,
        /\bexpected salary\b/,
        /\bcompensation expectation\b/
      ]
    ],

    [
      () => OPTIONAL.expectedDayRate,
      [/\bexpected day rate\b/]
    ],

    [
      () => OPTIONAL.certifications,
      [/^current certifications$/, /^list (?:your )?certifications$/]
    ],

    [
      () => OPTIONAL.showreelUrl,
      [/\bshowreel\s*(?:or\s*)?(?:website|url|link)\b/]
    ],

    [
      () => OPTIONAL.earliestStartDate,
      [
        /\bearliest start\b/,
        /\bavailable start\b/,
        /\bstart date\b/,
        /\bdate available\b/,
        /\bwhen can you start\b/
      ]
    ],

    [
      () => OPTIONAL.noticePeriod,
      [
        /\bnotice period\b/,
        /\bhow much notice\b/
      ]
    ],

    [
      () => OPTIONAL.remotePreference,
      [
        /\bremote preference\b/,
        /\bwork arrangement\b/,
        /\bwork location preference\b/
      ]
    ],

    [
      () => OPTIONAL.employmentType,
      [
        /\bemployment type\b/,
        /\bdesired employment\b/,
        /\bwork type\b/
      ]
    ],

    [
      () => OPTIONAL.desiredHoursPerWeek,
      [
        /\bhours per week\b/,
        /\bdesired hours\b/,
        /\bweekly hours\b/
      ]
    ],

    [
      () => OPTIONAL.travelPercentage,
      [
        /\btravel percentage\b/,
        /\bpercent.*travel\b/,
        /\btravel.*percent\b/
      ]
    ],

    [
      () => OPTIONAL.referralSource,
      [
        /\bhow did you hear\b/,
        /\bhow did you find\b/,
        /\breferral source\b/,
        /\bapplication source\b/
      ]
    ],

    [
      () => OPTIONAL.employeeReferralName,
      [
        /\bemployee referral\b/,
        /\breferrer\b/,
        /\bwho referred\b/
      ]
    ],

    [
      () => OPTIONAL.securityClearance,
      [
        /\bsecurity clearance\b/,
        /\bclearance level\b/
      ]
    ],

    [
      () => OPTIONAL.currentCompany,
      [
        /\bcurrent (company|employer)\b/
      ]
    ],

    [
      () => OPTIONAL.currentJobTitle,
      [
        /\bcurrent (job )?title\b/,
        /\bcurrent position\b/
      ]
    ]
  ];

  /*
   * YES / NO QUESTION MATCHING
   */

  const YES_NO_RULES = [
    [
      () => OPTIONAL.meetsListedMinimumRequirements,
      [/\b(?:do you|are you able to) meet all (?:of )?(?:the )?(?:above |listed |these )?minimum requirements\b/,
       /\bdo you meet all (?:of )?the (?:above|listed) requirements\b/]
    ],
    [
      () => OPTIONAL.currentlyAnEmployee,
      [/\bare you currently an employee\b/]
    ],
    [
      () => OPTIONAL.authorizedToWork,
      [
        /authorized.*work/,
        /legally.*work/,
        /work.*authorization/,
        /eligible.*work/
      ]
    ],

    [
      () => OPTIONAL.requiresSponsorship,
      [
        /require.*sponsor/,
        /need.*sponsor/,
        /visa.*sponsor/,
        /sponsorship/
      ]
    ],

    [
      () => OPTIONAL.willingToRelocate,
      [
        /willing.*relocat/,
        /open.*relocat/
      ]
    ],

    [
      () => OPTIONAL.willingToTravel,
      [
        /willing.*travel/,
        /travel.*required/
      ]
    ],

    [
      () => OPTIONAL.previouslyEmployedByCompany,
      [
        /previously.*employ/,
        /former.*employee/,
        /worked.*here.*before/
      ]
    ],

    [
      () => OPTIONAL.previouslyAppliedToCompany,
      [
        /previously.*appl/,
        /applied.*before/
      ]
    ],

    [
      () => OPTIONAL.nonCompeteAgreement,
      [
        /non.?compete/,
        /restrictive covenant/
      ]
    ],

    [
      () => OPTIONAL.conflictOfInterest,
      [
        /conflict.*interest/
      ]
    ]
  ];

  function isRequired(el) {
    if (
      el.required ||
      el.getAttribute(
        'aria-required'
      ) === 'true' || el.matches('.required,.isRequired,[data-required="true"]')
    ) {
      return true;
    }

    if (
      /\*/.test(
        getLabelText(el)
      )
    ) {
      return true;
    }

    const choiceGroup = el.closest('fieldset,[role="radiogroup"],[role="group"]');
    const legend = choiceGroup?.querySelector('legend');
    if (legend && /\*|\brequired\b/i.test(legend.textContent || '')) return true;
    if (choiceGroup?.matches('.required,.isRequired,[aria-required="true"],[data-required="true"]')) {
      const choices = [...choiceGroup.querySelectorAll('input:not([type="hidden"]),[role="radio"],[role="checkbox"]')];
      const controls = choiceGroup.querySelectorAll('input:not([type="hidden"]),textarea,select,[role="radio"],[role="checkbox"]');
      if (choices.length === controls.length && choices.length && choices.every(other => other.type === 'checkbox' ||
          other.getAttribute('role') === 'checkbox')) return true;
      if (choices.length === controls.length && choices.length && choices.every(other => (other.type === 'radio' ||
          other.getAttribute('role') === 'radio') && other.name === el.name)) return true;
    }

    const container =
      el.closest(
        '.required,[data-required="true"],.form-group,.field,.question'
      );

    if (!container) {
      return false;
    }

    const controls = [...container.querySelectorAll('input:not([type="hidden"]),textarea,select')];
    // A shared section may contain several unrelated questions. Its required
    // marker cannot safely be assigned to every control inside it.
    if (controls.length > 1 && !(el.type === 'radio' && controls.every(other =>
      other.type === 'radio' && other.name && other.name === el.name))) return false;

    const text =
      (
        container.innerText ||
        ''
      ).slice(
        0,
        250
      );

    return (
      /\*/.test(text) ||
      /\brequired\b/i.test(
        text
      )
    );
  }

  function highlightRequired() {
    document
      .querySelectorAll(
        'input, textarea, select'
      )
      .forEach((el) => {
        if (
          !isVisible(el) ||
          !isRequired(el) ||
          hasValue(el)
        ) {
          return;
        }

        if (
          [
            'hidden',
            'button',
            'submit'
          ].includes(
            el.type
          )
        ) {
          return;
        }

        const desc =
          getDescriptor(el);

        el.style.outline =
          isSensitive(desc)
            ? '3px solid #d89b00'
            : '3px solid #c94b4b';

        el.style.outlineOffset =
          '2px';

        el.title =
          isSensitive(desc)
            ? 'Manual review: sensitive/self-ID field'
            : 'Required field still needs an answer';
      });
  }


  let LEARNED_FIELDS = [];
  let IGNORED_FIELDS = [];
  let SITE_MAPPINGS = [];
  const MEMORY_LIMITS = Object.freeze({records: 2000, answerLength: 20000, alternates: 10});
  let SETTINGS = {bitwardenCompatibilityMode: false};
  let memoryUiInstalled = false;
  let activeMemoryField = null;
  let memoryButton = null;
  let memoryMenu = null;

  const memoryUnsafeTerms = [
    'password', 'passcode', 'pin', 'social security', 'ssn', 'bank account',
    'routing number', 'credit card', 'debit card', 'card number', 'cvv', 'cvc',
    'security code', 'driver license', 'drivers license', "driver's license",
    'driver’s license', 'passport',
    'date of birth', 'birth date', 'birthdate', 'dateofbirth', 'dob',
    'national id', 'taxpayer id', 'tax id', 'social insurance',
    'race', 'ethnicity', 'hispanic', 'latino', 'latina', 'latinx',
    'gender', 'sexual orientation', 'disability',
    'religion', 'marital status', 'veteran status', 'cc-number', 'cc-csc',
    'bday'
  ];

  function memoryQuestionText(el) {
    const groupPieces = [];
    const fieldset = el.closest('fieldset,[role="radiogroup"],[role="group"]');
    if (fieldset) {
      const legend = fieldset.querySelector('legend');
      if (legend) groupPieces.push(legend.innerText || legend.textContent || '');
      const labelledBy = fieldset.getAttribute('aria-labelledby');
      if (labelledBy) labelledBy.split(/\s+/).forEach(id => {
        const node = document.getElementById(id);
        if (node) groupPieces.push(node.innerText || node.textContent || '');
      });
    }
    // For radio groups, the legend/question is the identity. Including the
    // individual option label would make Yes and No look like different fields.
    if (groupPieces.some(Boolean) && (el.type === 'radio' || el.getAttribute('role') === 'radio')) {
      return normalize(groupPieces.filter(Boolean).join(' | '));
    }
    const pieces = [
      ...groupPieces,
      getLabelText(el),
      el.getAttribute('aria-label') || '',
      el.getAttribute('placeholder') || ''
    ];
    return normalize(pieces.filter(Boolean).join(' | '));
  }

  function memoryIdentity(el) {
    return {
      question: memoryQuestionText(el),
      name: normalize(el.getAttribute('name') || ''),
      id: normalize(el.id || ''),
      placeholder: normalize(el.getAttribute('placeholder') || ''),
      type: normalize(el.type || el.tagName),
      host: location.hostname
    };
  }

  function ignoredIdentity(el) {
    const identity = memoryIdentity(el);
    return {
      question: identity.question, name: identity.name, elementId: identity.id,
      placeholder: identity.placeholder, type: identity.type, host: identity.host
    };
  }

  function ignoredMatchScore(saved, el) {
    const current = ignoredIdentity(el);
    if (!saved.host || saved.host !== current.host) return 0;
    if (saved.question && current.question && saved.question !== current.question) return 0;
    let score = 1;
    if (saved.name && current.name && saved.name === current.name) score += 5;
    if (saved.elementId && current.elementId && saved.elementId === current.elementId) score += 5;
    if (saved.placeholder && current.placeholder && saved.placeholder === current.placeholder) score += 3;
    if (saved.question && current.question && saved.question === current.question) score += 8;
    if (saved.type && current.type && saved.type === current.type) score += 1;
    return score;
  }

  function findIgnoredField(el) {
    let best = null, bestScore = 0;
    for (const saved of IGNORED_FIELDS) {
      const score = ignoredMatchScore(saved, el);
      if (score > bestScore) { best = saved; bestScore = score; }
    }
    return bestScore >= 6 ? best : null;
  }
  function findSiteMapping(el) {
    let best=null,bestScore=0;
    for(const saved of SITE_MAPPINGS){const score=ignoredMatchScore(saved,el);if(score>bestScore){best=saved;bestScore=score;}}
    return bestScore>=6?best:null;
  }
  async function mapCurrentField(el) {
    if(!el||!el.isConnected||isMemoryUnsafe(el)){toast('This field cannot be mapped safely.');return;}
    const reference=prompt('Map to a profile field, for example profile.city or optional.authorizedToWork:','');
    if(reference===null)return;const [section,profileKey]=reference.trim().split('.');
    if(!['profile','optional'].includes(section)||!Object.hasOwn(JAMIE_DEFAULTS[section],profileKey)||Array.isArray(JAMIE_DEFAULTS[section][profileKey])){toast('That profile field was not recognized.');return;}
    const identity=ignoredIdentity(el),existing=findSiteMapping(el),record={key:existing?.key||`mapping-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      ...identity,label:memoryDisplayLabel(el),section,profileKey,updatedAt:Date.now()};
    SITE_MAPPINGS=existing?SITE_MAPPINGS.map(item=>item.key===existing.key?record:item):[...SITE_MAPPINGS,record];
    await browser.storage.local.set({siteMappings:SITE_MAPPINGS});toast(`Mapped this field to ${section}.${profileKey}.`);
  }

  async function setIgnoredField(el, ignored) {
    if (!el || !el.isConnected || !el.matches(reviewSelector) || ['hidden','password','file'].includes(el.type)) {
      toast('This control cannot be added to the ignore list.'); return;
    }
    const existing = findIgnoredField(el);
    if (!ignored && existing) {
      IGNORED_FIELDS = IGNORED_FIELDS.filter(item => item.key !== existing.key);
      await browser.storage.local.set({ignoredFields: IGNORED_FIELDS});
      updateMemoryControl(el);
      toast('This field will be offered again.');
      return;
    }
    if (!ignored) { toast('This field is already available.'); return; }
    if (existing) { toast('This field is already ignored.'); return; }
    if (IGNORED_FIELDS.length >= MEMORY_LIMITS.records) { toast('The ignored-field limit has been reached.'); return; }
    const identity = ignoredIdentity(el);
    if (![identity.question, identity.name, identity.elementId, identity.placeholder].some(Boolean)) {
      toast('This field has no stable identity and cannot be ignored safely.'); return;
    }
    IGNORED_FIELDS.push({
      key: `ignored-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      ...identity, label: memoryDisplayLabel(el), updatedAt: Date.now()
    });
    await browser.storage.local.set({ignoredFields: IGNORED_FIELDS});
    updateMemoryControl(el);
    toast('This field will be ignored on this website.');
  }

  function memoryDisplayLabel(el) {
    const raw = memoryQuestionText(el);
    return raw || normalize(el.name || el.id || el.placeholder || 'Unlabeled field');
  }

  function learnedMatchScore(saved, el) {
    const current = memoryIdentity(el);
    // A shared technical field name is not enough to reuse a different answer.
    if (saved.question && current.question && saved.question !== current.question) return 0;
    if (saved.host && current.host && saved.host !== current.host &&
        (!saved.question || !current.question)) return 0;
    let score = 0;
    if (saved.host && saved.host === current.host) score += 1;
    if (saved.name && current.name && saved.name === current.name) score += 5;
    if (saved.id && current.id && saved.id === current.id) score += 5;
    if (saved.placeholder && current.placeholder && saved.placeholder === current.placeholder) score += 3;
    if (saved.question && current.question && saved.question === current.question) score += 8;
    else if (saved.question && current.question && saved.question.length >= 12 && current.question.length >= 12 &&
      (saved.question.includes(current.question) || current.question.includes(saved.question))) score += 4;
    if (saved.type && current.type && saved.type === current.type) score += 1;
    return score;
  }

  // The answer to use from a remembered field. The main answer is used unless the field is a list or a group of choices
  // that doesn't offer it: then the first other answer it does offer.
  function pickLearnedAnswer(el, learned) {
    const answers = [learned.answer, ...(Array.isArray(learned.alternates) ? learned.alternates : [])]
      .map(value => String(value ?? '')).filter(value => value.trim());
    let offered = null;
    if (el instanceof HTMLSelectElement) {
      offered = [...el.options].flatMap(option => [normalize(option.textContent || ''), normalize(option.value || '')]);
    } else if (el.type === 'radio') {
      offered = choiceGroup(el).flatMap(option => [normalize(getLabelText(option) || ''), normalize(option.value || '')]);
    }
    if (offered) return answers.find(value => offered.includes(normalize(value))) ?? answers[0];
    return answers[0];
  }

  function findLearnedField(el) {
    if (isMemoryUnsafe(el)) return null;
    let best = null;
    let bestScore = 0;
    for (const saved of LEARNED_FIELDS) {
      const score = learnedMatchScore(saved, el);
      if (score > bestScore) { best = saved; bestScore = score; }
    }
    return bestScore >= 6 ? best : null;
  }

  function isMemoryUnsafe(el) {
    if (!el || el.type === 'password' || el.type === 'file' || el.type === 'hidden') return true;
    const desc = `${getDescriptor(el)} ${memoryQuestionText(el)}`;
    return isRecordDetailsPage() || isConsentQuestion(el) || memoryUnsafeTerms.some(term => desc.includes(term)) ||
      /\b(?:last|final|ending)\s*(?:4|four)\b/.test(desc);
  }

  function isCredentialControl(el) {
    if (!SETTINGS.bitwardenCompatibilityMode) return false;
    const autocomplete = normalize(el?.getAttribute?.('autocomplete'));
    const descriptor = `${getDescriptor(el)} ${memoryQuestionText(el)}`;
    return el?.type === 'password' || /(?:^| )(?:username|current password|new password|one time code)(?: |$)/.test(autocomplete) ||
      /\b(?:sign in|log in|login|username|password|passcode|one time code|verification code)\b/.test(descriptor);
  }

  function choiceGroup(el) {
    if (el.type === 'radio' && el.name) {
      return [...document.querySelectorAll('input[type="radio"]')]
        .filter(other => other.name === el.name && other.form === el.form);
    }
    if (el.type === 'checkbox') return [el];
    return [];
  }

  function valueForMemory(el) {
    if (el instanceof HTMLSelectElement) {
      const option = el.options[el.selectedIndex];
      return option ? (option.textContent || option.value || '').trim() : '';
    }
    if (el.type === 'radio') {
      const checked = choiceGroup(el).find(other => other.checked);
      if (!checked) return '';
      return (getLabelText(checked) || checked.value || '').trim();
    }
    if (el.type === 'checkbox') return el.checked ? 'Yes' : 'No';
    return String(el.value || '').trim();
  }

  async function persistLearnedFields() {
    await browser.storage.local.set({ learnedFields: LEARNED_FIELDS });
  }

  async function rememberCurrentField(mode, field = activeMemoryField) {
    const el = field;
    if (!el || !el.isConnected) { toast('Click a form field first.'); return; }
    if (isMemoryUnsafe(el)) { toast('This type of sensitive field is not saved.'); return; }
    const existing = findLearnedField(el);
    let value = valueForMemory(el);
    if (!value) {
      value = window.prompt('What should I remember for this field?', existing?.answer || '');
      if (value === null) return;
      value = value.trim();
    }
    if (!value) { toast('Enter an answer in the field first.'); return; }
    if (value.length > MEMORY_LIMITS.answerLength) { toast('This answer is too long to remember safely.'); return; }
    if (!existing && LEARNED_FIELDS.length >= MEMORY_LIMITS.records) { toast('The remembered-field limit has been reached.'); return; }
    const identity = memoryIdentity(el);
    const others = (existing?.alternates || []).filter(other => other !== value);
    let answer = value;
    if (existing && mode === 'alternate') {
      // Keep the main answer; this one joins the others.
      if (value === existing.answer || others.length >= MEMORY_LIMITS.alternates && !others.includes(value)) {
        toast(value === existing.answer ? 'That is already the main answer.' : 'This field already has the most answers it can keep.'); return;
      }
      answer = existing.answer;
      others.push(value);
    } else if (existing && mode === 'primary' && value !== existing.answer) {
      // This one becomes the main answer; the old main answer is kept as another answer.
      if (others.length >= MEMORY_LIMITS.alternates) { toast('This field already has the most answers it can keep.'); return; }
      others.push(existing.answer);
    }
    const record = {
      id: existing?.id || `learned-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      ...identity,
      label: memoryDisplayLabel(el),
      answer,
      alternates: [...new Set(others)].filter(other => other && other !== answer),
      updatedAt: Date.now()
    };
    if (existing) LEARNED_FIELDS = LEARNED_FIELDS.map(item => item.id === existing.id ? record : item);
    else LEARNED_FIELDS.push(record);
    await persistLearnedFields();
    updateMemoryControl(el);
    toast(mode === 'alternate' ? 'Added as another answer.' : mode === 'primary' ? 'Now the main answer.'
      : mode === 'update' || existing ? 'Remembered answer updated.' : 'Field remembered.');
  }

  async function removeCurrentField() {
    const el = activeMemoryField;
    const existing = el && findLearnedField(el);
    if (!existing) { toast('This field is not currently remembered.'); return; }
    LEARNED_FIELDS = LEARNED_FIELDS.filter(item => item.id !== existing.id);
    await persistLearnedFields();
    updateMemoryControl(el);
    toast('Remembered field removed.');
  }

  function ensureMemoryControls() {
    if (memoryButton && !memoryButton.isConnected) memoryButton = null;
    if (memoryMenu && !memoryMenu.isConnected) memoryMenu = null;
    if (!memoryButton) {
      memoryButton = document.createElement('button');
      memoryButton.id = 'jk-field-memory-button';
      memoryButton.type = 'button';
      memoryButton.textContent = '+';
      memoryButton.setAttribute('aria-label', 'Remember or update this field');
      memoryButton.addEventListener('mousedown', event => event.preventDefault());
      memoryButton.addEventListener('click', event => {
        event.preventDefault(); event.stopPropagation();
        if (!activeMemoryField) return;
        positionMemoryControl(activeMemoryField);
        memoryMenu.style.display = memoryMenu.style.display === 'block' ? 'none' : 'block';
      });
      document.body.appendChild(memoryButton);
    }
    if (!memoryMenu) {
      memoryMenu = document.createElement('div');
      memoryMenu.id = 'jk-field-memory-menu';
      setStaticHtml(memoryMenu, `
        <div class="jk-memory-title">Field memory</div>
        <button type="button" data-memory="remember">Remember this field</button>
        <button type="button" data-memory="update">Update this field</button>
        <button type="button" data-memory="alternate">Add as another answer</button>
        <button type="button" data-memory="primary">Make this the main answer</button>
        <button type="button" data-memory="remove">Remove this field</button>
        <button type="button" data-memory="map">Map to profile field</button>
        <button type="button" data-memory="ignore">Ignore this field</button>`);
      memoryMenu.addEventListener('mousedown', event => event.preventDefault());
      memoryMenu.addEventListener('click', async event => {
        const button = event.target.closest('button[data-memory]');
        if (!button || button.disabled) return;
        event.preventDefault(); event.stopPropagation();
        memoryMenu.style.display = 'none';
        if (button.dataset.memory === 'remove') await removeCurrentField();
        else if(button.dataset.memory==='map')await mapCurrentField(activeMemoryField);
        else if(button.dataset.memory==='ignore')await setIgnoredField(activeMemoryField,!findIgnoredField(activeMemoryField));
        else await rememberCurrentField(button.dataset.memory);
      });
      document.body.appendChild(memoryMenu);
    }
  }

  function positionMemoryControl(el) {
    if (!memoryButton || !memoryMenu || !el?.isConnected) return;
    const rect = el.getBoundingClientRect();
    const size = 28;
    let left = Math.min(window.innerWidth - size - 6, Math.max(6, rect.right + 6));
    let top = Math.min(window.innerHeight - size - 6, Math.max(6, rect.top + Math.min(8, Math.max(0, (rect.height - size) / 2))));
    if (left + size + 4 > window.innerWidth) left = Math.max(6, rect.right - size - 4);
    memoryButton.style.left = `${left}px`;
    memoryButton.style.top = `${top}px`;
    if (memoryMenu.style.display === 'block') {
      const menuWidth = 210, menuHeight = 215;
      let menuLeft = Math.min(window.innerWidth - menuWidth - 6, left);
      let menuTop = top + size + 6;
      if (menuTop + menuHeight > window.innerHeight) menuTop = Math.max(6, top - menuHeight - 6);
      memoryMenu.style.left = `${menuLeft}px`;
      memoryMenu.style.top = `${menuTop}px`;
    }
  }

  function updateMemoryControl(el) {
    if (!el || !isVisible(el) || isMemoryUnsafe(el) || isCredentialControl(el) || el.closest('#jk-autofill-panel,#jk-review-host,#jk-field-memory-menu')) {
      if (memoryButton) memoryButton.style.display = 'none';
      if (memoryMenu) memoryMenu.style.display = 'none';
      return;
    }
    ensureMemoryControls();
    activeMemoryField = el;
    const saved = findLearnedField(el);
    memoryButton.dataset.saved = saved ? 'true' : 'false';
    memoryButton.textContent = saved ? '✓' : '+';
    memoryButton.title = saved ? 'This field is remembered' : 'Remember this field';
    const title = memoryMenu.querySelector('.jk-memory-title');
    title.textContent = (memoryDisplayLabel(el) || 'Field').slice(0, 80);
    const remember = memoryMenu.querySelector('[data-memory="remember"]');
    const update = memoryMenu.querySelector('[data-memory="update"]');
    const alternate = memoryMenu.querySelector('[data-memory="alternate"]');
    const primary = memoryMenu.querySelector('[data-memory="primary"]');
    const remove = memoryMenu.querySelector('[data-memory="remove"]');
    memoryMenu.querySelector('[data-memory="ignore"]').textContent=findIgnoredField(el)?'Use this field again':'Ignore this field';
    remember.disabled = !!saved;
    update.disabled = !saved;
    alternate.disabled = !saved;
    primary.disabled = !saved;
    remove.disabled = !saved;
    memoryButton.style.display = 'block';
    positionMemoryControl(el);
  }

  function installMemoryFieldUI() {
    ensureMemoryControls();
    if (memoryUiInstalled) return;
    memoryUiInstalled = true;
    document.addEventListener('focusin', event => {
      const el = event.target;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || isCustom(el)) {
        updateMemoryControl(el);
      }
    }, true);
    document.addEventListener('pointerdown', event => {
      const el = event.target;
      if (el === memoryButton || memoryMenu?.contains(el)) return;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || isCustom(el)) {
        setTimeout(() => updateMemoryControl(el), 0);
      } else if (!memoryMenu?.contains(el)) {
        if (memoryMenu) memoryMenu.style.display = 'none';
        if (memoryButton) memoryButton.style.display = 'none';
      }
    }, true);
    window.addEventListener('scroll', () => activeMemoryField && positionMemoryControl(activeMemoryField), true);
    window.addEventListener('resize', () => activeMemoryField && positionMemoryControl(activeMemoryField));
  }

  async function loadSavedProfile() {
    const saved = await browser.storage.local.get(['jamieProfile', 'learnedFields', 'ignoredFields', 'siteMappings', 'settings']);
    if (saved.jamieProfile) {
      Object.assign(PROFILE, saved.jamieProfile.profile);
      Object.assign(OPTIONAL, saved.jamieProfile.optional);
    }
    LEARNED_FIELDS = Array.isArray(saved.learnedFields) ? saved.learnedFields : [];
    IGNORED_FIELDS = Array.isArray(saved.ignoredFields) ? saved.ignoredFields : [];
    SITE_MAPPINGS = Array.isArray(saved.siteMappings) ? saved.siteMappings : [];
    SETTINGS = {bitwardenCompatibilityMode: saved.settings?.bitwardenCompatibilityMode === true};
  }
  const reviewSelector = 'input, textarea, select, [role="combobox"], button[aria-haspopup="listbox"], [role="checkbox"], [role="radio"], [contenteditable="true"][role="textbox"], [contenteditable="true"][aria-label]';
  const REVIEW_SCAN_LIMITS = Object.freeze({fields: 1000, shadowRoots: 24, shadowHostNodes: 12000});
  const isCustom = el => !(el instanceof HTMLSelectElement) &&
    (el.getAttribute('role') === 'combobox' || el.getAttribute('aria-haspopup') === 'listbox');
  const isChoice = el => ['radio','checkbox'].includes(el.type) || ['radio','checkbox'].includes(el.getAttribute('role'));
  const isChecked = el => el.checked === true || el.getAttribute('aria-checked') === 'true';
  function contextMenuField(targetElementId) {
    const target = browser.menus.getTargetElement(targetElementId);
    return target?.matches?.(reviewSelector) ? target : target?.closest?.(reviewSelector);
  }
  browser.runtime.onMessage.addListener(message => {
    if (!['field-menu-state','set-ignore-field','save-field'].includes(message?.type) || message.targetElementId == null) return;
    const field = contextMenuField(message.targetElementId);
    if (message.type === 'field-menu-state') return Promise.resolve({
      supported: !!field && !['hidden','password','file'].includes(field.type),
      ignored: !!field && !!findIgnoredField(field),
      savable: !!field && !isMemoryUnsafe(field)
    });
    if (message.type === 'set-ignore-field') {
      return setIgnoredField(field, message.ignored === true).catch(() => toast('Could not update the ignore rule.'));
    }
    return rememberCurrentField('remember', field).catch(() => toast('Could not save this field.'));
  });
  function directLabel(el) {
    const explicit = [...(el.labels || [])].map(label => label.textContent.trim()).filter(Boolean);
    const labelled = (el.getAttribute('aria-labelledby') || '').split(/\s+/).map(id => rootElementById(el, id)?.textContent || '').join(' ').trim();
    // Microsoft Forms gives every text box the aria-label "Single line text" and names the real question through
    // aria-labelledby; a label that only names the kind of control never beats the question it points to.
    const ariaLabel = el.getAttribute('aria-label') || '';
    const genericAria = /^\s*(?:(?:single|multi(?:ple)?)[\s-]*line(?: text)?|enter your answer|text(?: ?(?:box|field|input))?|answer|input)\s*$/i.test(ariaLabel);
    const text = explicit[0] || (genericAria && labelled) || ariaLabel || labelled || el.getAttribute('placeholder') ||
      (isChoice(el) ? el.textContent : '') || el.getAttribute('name') || el.id || '';
    return normalize(text.replace(/([a-z])([A-Z])/g, '$1 $2'));
  }
  function choiceLabelText(el) {
    const explicit = [...(el.labels || [])].map(label => label.textContent || '').find(Boolean);
    const labelledBy = (el.getAttribute('aria-labelledby') || '').split(/\s+/)
      .map(id => rootElementById(el, id)?.textContent || '').join(' ');
    return normalize(explicit || el.getAttribute('aria-label') || labelledBy ||
      el.closest('label')?.textContent || (el.getAttribute('role') ? el.textContent : ''));
  }
  function currentAnswer(el) {
    if (isChoice(el)) return isChecked(el);
    if (el.isContentEditable) return !!normalize(el.textContent);
    if (!isCustom(el)) return hasValue(el);
    const text = normalize(el.value || el.textContent || '');
    return !!text && !/^(?:please )?(?:select|choose|pick|search)(?:\b.*)?$/.test(text);
  }
  function proposedAnswerIsCurrent(el, item) {
    if (!currentAnswer(el)) return false;
    if (isChoice(el)) return isChecked(el) && normalize(valueForMemory(el)) === normalize(item.value);
    if (el instanceof HTMLSelectElement) {
      const option = matchingOption([...el.options], item);
      return !!option && option.selected;
    }
    return normalize(el.isContentEditable ? el.textContent : el.value) === normalize(item.value);
  }
  function peers(el) {
    if (el.type === 'radio' && el.name) return [...elementRoot(el).querySelectorAll('input[type="radio"]')]
      .filter(other => other.name === el.name && other.form === el.form);
    return [...(el.closest('fieldset,[role="radiogroup"],[role="group"],.form-group,.question,.field') || el.parentElement)
      .querySelectorAll('input[type="checkbox"],input[type="radio"],[role="checkbox"],[role="radio"]')];
  }
  function contextLabel(el) {
    const group = el.closest('fieldset,[role="radiogroup"],[role="group"],.form-group,.question,.field');
    return normalize([directLabel(el), group?.innerText || '', el.getAttribute('autocomplete') || ''].join(' '));
  }
  function eeoQuestion(el) {
    const group = el.closest('fieldset,[role="radiogroup"],[role="group"],.question,.form-group,.field');
    const legend = group?.querySelector('legend');
    const labelledBy = group?.getAttribute('aria-labelledby') || '';
    const labelledText = labelledBy.split(/\s+/).map(id => rootElementById(el, id)?.textContent || '').join(' ');
    const groupLabel = group?.getAttribute('aria-label') || '';
    // The option's label is an answer, not evidence of what the question asks.
    return normalize([legend?.textContent || '', labelledText, groupLabel,
      isChoice(el) ? '' : directLabel(el)].filter(Boolean).join(' '));
  }
  function isEeoQuestion(el) {
    return /\b(?:hispanic|latino|latina|latinx|race|racial|ethnicity|gender|sex assigned at birth|veteran status|protected veteran)\b/.test(eeoQuestion(el)) ||
      isGeneralVeteranQuestion(el);
  }
  function isGeneralVeteranQuestion(el) {
    const question = eeoQuestion(el);
    return /^(?:are you (?:a |an )?(?:military )?veteran|have you (?:ever )?served in (?:the )?(?:us |u s )?(?:military|armed forces))(?: select one)?$/.test(question);
  }
  function veteranAnswer(el) {
    const question = eeoQuestion(el);
    if (isGeneralVeteranQuestion(el)) {
      const saved = OPTIONAL.hasServedInMilitary;
      if (!['Yes', 'No'].includes(saved) || el.type === 'checkbox') return null;
      if (isChoice(el)) return !peers(el).some(isChecked) && choiceLabelText(el) === normalize(saved) ? {value: saved} : null;
      return {value: saved};
    }
    if (!/\bveteran status\b|\bprotected veteran\b|\bmilitary veteran status\b/.test(question)) return null;
    const saved = String(OPTIONAL.veteranStatus || '').trim();
    if (!saved) return null;
    if (isChoice(el)) return !peers(el).some(isChecked) && choiceLabelText(el) === normalize(saved) ? {value: saved} : null;
    return {value: saved};
  }
  function isConsentQuestion(el) {
    if (!isChoice(el)) return false;
    const group = el.closest('fieldset,[role="radiogroup"],[role="group"]');
    const choice = directLabel(el);
    const question = normalize([group?.querySelector('legend')?.textContent || '',
      group?.getAttribute('aria-label') || ''].join(' '));
    const legalTerms = /\b(?:electronic consent|terms and conditions|state disclosures?|dispute resolution (?:program|policy)|arbitration agreement|application agreement|privacy notice|consent to the processing of my data)\b/;
    if (choice === 'i understand and agree to the terms outlined above' &&
        /\b(?:omission|misrepresentation|falsification)\b/.test(question)) return true;
    if (legalTerms.test(choice) || /\bi (?:acknowledge|certify) that i (?:have )?(?:read|understand)\b|\bi do not agree and wish to end\b/.test(choice)) return true;
    if (!/^i (?:agree|accept|consent|acknowledge|certify)$/.test(choice)) return false;
    if (legalTerms.test(question)) return true;
    return el.type === 'radio' && peers(el).some(other =>
      other !== el && /\bi do not agree and wish to end\b/.test(directLabel(other)));
  }
  function isRecordDetailsPage() {
    const title = normalize(document.title);
    return /\b(?:work|employment) history\b/.test(title) ||
      /^(?:previous address|education) application for employment\b/.test(title);
  }
  function isWorkPreferenceQuestion(el) {
    return el.type === 'radio' && /^work preference$/.test(normalize(
      el.closest('fieldset,[role="radiogroup"]')?.querySelector('legend')?.textContent));
  }
  function workPreferenceAnswer(el) {
    if (!isWorkPreferenceQuestion(el) || !OPTIONAL.employmentType || peers(el).some(isChecked)) return null;
    return choiceLabelText(el) === normalize(OPTIONAL.employmentType) ? {value: OPTIONAL.employmentType} : null;
  }
  function configuredChoiceAnswer(el) {
    if (!isChoice(el)) return undefined;
    const question = eeoQuestion(el);
    const rules = [
      [/\b(?:remote hybrid or onsite preference|work arrangement|work location preference)\b/, OPTIONAL.remotePreference, false],
      [/\b(?:employment preference|employment type|work preference)\b/, OPTIONAL.employmentType, false],
      [/\b(?:leadership roles|leadership preference|individual contributor roles)\b/, OPTIONAL.leadershipPreference, false],
      [/\b(?:what team or area are you most interested in|team or area most interested in)\b/, OPTIONAL.teamInterest, false],
      [/\b(?:which functions are you interested in working|functions are you interested in working)\b/, OPTIONAL.interestedFunctions, true],
      [/\b(?:technical or functional skill areas|select your skill areas)\b/, OPTIONAL.technicalSkillAreas, true],
      [/\b(?:language skill(?:s| s)?|languages spoken|which languages do you speak|languages you speak)\b/, OPTIONAL.spokenLanguages, true]
    ].filter(([pattern]) => pattern.test(question));
    if (rules.length > 1 || rules.length && isSensitive(question)) return null;
    if (!rules.length || !String(rules[0][1] || '').trim()) return undefined;
    const [, saved, multiple] = rules[0];
    if (multiple && el.type !== 'checkbox' && el.getAttribute('role') !== 'checkbox') return null;
    if (!multiple && peers(el).some(isChecked)) return null;
    const choice = choiceLabelText(el);
    const answers = multiple ? String(saved).split(/\r?\n/).map(line => line.trim()).filter(Boolean) : [String(saved).trim()];
    const exact = answers.find(answer => normalize(answer) === choice);
    return exact ? {value: exact} : null;
  }
  function eeoAnswer(el) {
    const question = eeoQuestion(el);
    const categories = [
      [/\b(?:hispanic|latino|latina|latinx)\b/, OPTIONAL.eeoHispanicLatino],
      [/\b(?:race|racial)\b/, OPTIONAL.eeoRace],
      [/\bgender\b/, OPTIONAL.eeoGender]
    ].filter(([pattern]) => pattern.test(question));
    if (categories.length !== 1 || /\b(?:gender identity|sex assigned at birth|sexual orientation)\b/.test(question) ||
        (/\bethnicity\b/.test(question) && !/\b(?:hispanic|latino|latina|latinx)\b/.test(question))) return null;
    const saved = categories[0][1];
    if (!String(saved || '').trim()) return null;
    if (isChoice(el)) {
      if (peers(el).some(isChecked)) return null;
      const choice = choiceLabelText(el);
      if (choice !== normalize(saved)) return null;
    }
    return {value: String(saved).trim()};
  }
  // The profile rule for a field's label, or undefined. Two cases the label rules alone get wrong: generic Name / Email /
  // Phone boxes in a referral block (ids such as ReferralName) describe the person who referred you, and a long
  // free-text question that merely mentions "city" or "state" is not asking for that answer.
  function matchRule(el, direct) {
    const rule = RULES.find(([, patterns, excludes = [], textareaOnly = false]) =>
      (!textareaOnly || el instanceof HTMLTextAreaElement) && !excludes.some(rx => rx.test(direct)) && patterns.some(rx => rx.test(direct)));
    if (!rule) return undefined;
    if (!rule[3] && el instanceof HTMLTextAreaElement && direct.split(' ').length > 10) return undefined;
    const idHint = normalize(`${el.id} ${el.getAttribute('name') || ''}`.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' '));
    if (/\b(?:referral|referrer)\b/.test(idHint) && /\b(?:name|e ?mail|phone|telephone)\b/.test(direct)) return undefined;
    return rule;
  }
  function answerFor(el) {
    const direct = directLabel(el);
    const desc = contextLabel(el);
    // Previous addresses, schools, and employers are distinct records. Generic
    // applicant fields and learned IDs cannot safely identify the right one.
    if (isRecordDetailsPage() || /\bminimally acceptable rate of pay\b/.test(direct)) return null;
    // Legal acknowledgements require a fresh, manual decision on each page.
    if (isConsentQuestion(el)) return null;
    const mapped=findSiteMapping(el);
    if(mapped){const raw=(mapped.section==='profile'?PROFILE:OPTIONAL)[mapped.profileKey],typed=typedAnswer(el,raw);
      if(typed)return {value:typed,siteMapped:true,matchReason:`Site mapping → ${mapped.section}.${mapped.profileKey}`,confidence:'High'};}
    // A phone extension is a short number. The phone number, a device type such as "Mobile", or a remembered answer that
    // is not a number never goes into it, however the page labels its neighbouring fields.
    if (/\b(?:phone|telephone|tel|mobile|cell|office|work)\b.*\bext(?:ension)?\b|^ext(?:ension)?\b|\bext(?:ension)? (?:number|no)\b/.test(direct)) {
      const remembered = String(findLearnedField(el)?.answer || '').trim();
      return /^\d{1,8}$/.test(remembered) ? {value: remembered, learned: true, matchReason: 'Exact remembered field', confidence: 'High'} : null;
    }
    if (isWorkPreferenceQuestion(el) && OPTIONAL.employmentType) return workPreferenceAnswer(el);
    const configuredChoice = configuredChoiceAnswer(el);
    if (configuredChoice !== undefined) return configuredChoice;
    const eeo = eeoAnswer(el);
    if (eeo) return eeo;
    if (isGeneralVeteranQuestion(el) || /\bveteran status\b|\bprotected veteran\b/.test(eeoQuestion(el))) return veteranAnswer(el);
    const learned = findLearnedField(el);
    if (learned && learned.answer) {
      const chosen = pickLearnedAnswer(el, learned);
      const wanted = normalize(chosen);
      if (el.type === 'radio' || el.getAttribute('role') === 'radio') {
        const option = normalize(getLabelText(el) || el.textContent || el.value || '');
        if (option === wanted || normalize(el.value || '') === wanted) return {value: String(chosen), learned: true,matchReason:'Exact remembered field',confidence:'High'};
      } else if (el.type === 'checkbox' || el.getAttribute('role') === 'checkbox') {
        if (['yes','true','checked','1'].includes(wanted)) return {value: String(chosen), learned: true,matchReason:'Exact remembered field',confidence:'High'};
      } else {
        const typed=typedAnswer(el,chosen);
        return typed?{value:typed,learned:true,matchReason:'Exact remembered field',confidence:'High'}:null;
      }
    }
    if (isChoice(el)) {
      if (peers(el).some(isChecked)) return null;
      if (isSensitive(desc)) return null;
      if (el.type === 'checkbox' && /^(?:mobile|cell(?:ular)?)(?: phone)?(?: number)?$/.test(direct) &&
          normalize(PROFILE.phoneDeviceType) === 'mobile') return {value: 'Yes'};
      if (!['yes','no'].includes(direct)) return null;
      const rule = YES_NO_RULES.find(([, patterns]) => patterns.some(rx => rx.test(desc)));
      return rule && normalize(rule[0]()) === direct ? {value: rule[0]()} : null;
    }
    if (/\b(?:ssn|social security(?: number)?)\b/.test(direct) &&
      /\b(?:last|final|ending) (?:4|four)(?: digits?)?\b/.test(direct) &&
      !/\b(?:full|entire|complete|nine|9)\b/.test(direct)) {
      return /^\d{4}$/.test(OPTIONAL.ssnLastFour || '') ? {value: OPTIONAL.ssnLastFour} : null;
    }
    if (isSensitive(direct)) return null;
    if (/\b(?:last|final|ending) (?:4|four)(?: digits?)?\b/.test(direct)) return null;
    if (/\b(?:dial|dialing|dialling|calling) (?:code|prefix)\b/.test(direct) ||
      /\btel country code\b/.test(normalize(el.getAttribute('autocomplete'))) ||
      (/\b(?:phone|mobile|telephone)\b/.test(direct) && /\b(?:country|prefix|code)\b/.test(direct)))
      return PROFILE.phoneCountryCode ? {value: PROFILE.phoneCountryCode, phoneCode: true} : null;
    const phonePart = phonePartAnswer(el);
    if (phonePart) return {value: phonePart};
    // Match the question itself, not the option names in its dropdown.
    const yesNo = YES_NO_RULES.find(([, patterns]) => patterns.some(rx => rx.test(direct)));
    const rule = yesNo || matchRule(el, direct);
    const value = rule?.[0]();
    if (rule?.[0] === phoneValue) {
      const formatted = phoneAnswer(el);
      return formatted ? {value: formatted} : null;
    }
    if (!value) return null;
    const typed = typedAnswer(el, value);
    return typed ? {value: typed} : null;
  }
  function typedAnswer(el, value) {
    const answer=String(value).trim();
    if (!(el instanceof HTMLInputElement) || el.type!=='date') return answer;
    let match=answer.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      const us=answer.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
      if (us) match=[answer,us[3],us[1].padStart(2,'0'),us[2].padStart(2,'0')];
    }
    if (!match) return null;
    const [,year,month,day]=match, date=new Date(`${year}-${month}-${day}T00:00:00Z`);
    return date.getUTCFullYear()===Number(year)&&date.getUTCMonth()+1===Number(month)&&date.getUTCDate()===Number(day)?
      `${year}-${month}-${day}`:null;
  }
  function phoneAnswer(el) {
    const saved = String(PROFILE.phone || '').trim();
    if (!saved || !(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return null;
    const digits = saved.replace(/\D/g, '');
    const country = String(PROFILE.phoneCountryCode || '').replace(/\D/g, '');
    const national = digits.length === 10 ? digits :
      country === '1' && digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : '';
    if (!national || (country && country !== '1')) return candidateFits(el, saved) ? saved : null;
    const area = national.slice(0, 3), exchange = national.slice(3, 6), line = national.slice(6);
    const formats = {
      digits: national,
      dashed: `${area}-${exchange}-${line}`,
      spaced: `${area} ${exchange} ${line}`,
      parenthesized: `(${area}) ${exchange}-${line}`,
      international: `+1${national}`,
      internationalSpaced: `+1 ${area} ${exchange} ${line}`
    };
    const hint = [el.placeholder, el.getAttribute('aria-label'), el.getAttribute('title'),
      el.getAttribute('pattern'), getLabelText(el)].filter(Boolean).join(' ');
    let preferred = [];
    if (/\+1[\s().-]*\(?\d|international|e\.164/i.test(hint)) preferred = [formats.international, formats.internationalSpaced];
    else if (/\((?:\d{3}|_{3})\)[\s.-]*(?:\d{3}|_{3})/.test(hint)) preferred = [formats.parenthesized];
    else if (/(?:\d{3}|_{3})-(?:\d{3}|_{3})-(?:\d{4}|_{4})/.test(hint)) preferred = [formats.dashed];
    else if (/\d{3} \d{3} \d{4}/.test(hint)) preferred = [formats.spaced];
    else if (/digits? only|numbers? only|10 digits?|numeric/i.test(hint)) preferred = [formats.digits];
    const candidates = [...new Set([...preferred, saved, ...Object.values(formats)])];
    const valid = candidates.filter(candidate => candidateFits(el, candidate));
    // A permissive field gives no evidence that changing punctuation is needed.
    return valid.includes(saved) && !preferred.length ? saved : valid[0] || null;
  }
  function phonePartAnswer(el) {
    if (!(el instanceof HTMLInputElement)) return null;
    const token = String(el.getAttribute('autocomplete') || '').trim().split(/\s+/).at(-1);
    if (!/^tel-(?:national|area-code|local|local-prefix|local-suffix)$/.test(token)) return null;
    const saved = String(PROFILE.phone || '').replace(/\D/g, '');
    const country = String(PROFILE.phoneCountryCode || '').replace(/\D/g, '');
    if (country && country !== '1') return null;
    const national = saved.length === 10 ? saved :
      country === '1' && saved.length === 11 && saved.startsWith('1') ? saved.slice(1) : '';
    if (!national) return null;
    const parts = {
      'tel-national': national,
      'tel-area-code': national.slice(0, 3),
      'tel-local': national.slice(3),
      'tel-local-prefix': national.slice(3, 6),
      'tel-local-suffix': national.slice(6)
    };
    return candidateFits(el, parts[token]) ? parts[token] : null;
  }
  function matchingOption(options, item) {
    const available = options.filter(o => !o.disabled && o.getAttribute?.('aria-disabled') !== 'true' && !o.parentElement?.disabled);
    const texts = o => [o.textContent, o.value].filter(v => v != null).map(normalize);
    if (item.phoneCode && /^\+?1$/.test(String(item.value).trim())) return available.find(o => texts(o).some(t => /^(us|usa|united states(?: of america)?)(?: \+?1)?$/.test(t))) ||
      available.find(o => /^\+?1$/.test((o.textContent || '').trim()));
    const wanted = normalize(item.value);
    const aliases = {
      maryland: [normalize(PROFILE.stateCode), 'maryland md', 'md maryland', 'us md'],
      'united states': ['us','usa','united states of america','united states us','united states usa','us united states','usa united states','united states of america usa','u s','u s a'],
      mobile: ['mobile phone','cell','cell phone','cellular'],
      linkedin: ['linked in'], '40': ['40 hours','40 hours per week','40 hrs per week']
    };
    const extra = wanted === normalize(PROFILE.state) ? [normalize(PROFILE.stateCode)] : wanted === normalize(PROFILE.country) ? [normalize(PROFILE.countryCode)] : [];
    const acceptable = [wanted, ...(aliases[wanted] || []), ...extra].filter(Boolean);
    return available.find(o => texts(o).some(t => acceptable.includes(t))) ||
      (wanted.includes('bachelor') ? available.find(o => normalize(o.textContent).includes('bachelor')) : undefined);
  }
  function candidateFits(el, value) {
    if (el.isContentEditable) return false;
    if (isChoice(el) || isCustom(el)) return true;
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return true;
    if (el.type === 'file') return false;
    const answer = String(value);
    if (el.maxLength >= 0 && answer.length > el.maxLength) return false;
    if (el.minLength >= 0 && answer.length < el.minLength) return false;
    const probe = document.createElement(el instanceof HTMLTextAreaElement ? 'textarea' : 'input');
    if (el instanceof HTMLInputElement) probe.type = el.type;
    for (const attribute of ['min', 'max', 'step', 'pattern', 'multiple']) {
      const setting = el.getAttribute(attribute);
      if (setting !== null) probe.setAttribute(attribute, setting);
    }
    try {
      probe.value = answer;
      return probe.value === answer && probe.checkValidity();
    } catch {
      return false;
    }
  }
  function sharedCheckboxGroup(el) {
    if (el.type !== 'checkbox') return null;
    const group = el.closest('fieldset,[role="group"]');
    if (!group) return null;
    const choices = [...group.querySelectorAll('input[type="checkbox"],[role="checkbox"]')];
    if (choices.length < 2) return null;
    const legend = normalize(group.querySelector('legend')?.textContent);
    const availabilityDays = /\bdays and times you are available to work\b/.test(legend);
    const sharedRequirement = /\brequired\b/.test(legend) || /\*/.test(group.querySelector('legend')?.textContent || '') ||
      group.matches('[aria-required="true"],[data-required="true"]');
    const individuallyRequired = choices.some(choice => choice.required ||
      choice.getAttribute('aria-required') === 'true');
    return availabilityDays || (sharedRequirement && !individuallyRequired) ? group : null;
  }
  function discoverReviewElements() {
    const fields = [], roots = [document];
    let truncated = false, visitedHosts = 0;
    for (let rootIndex = 0; rootIndex < roots.length; rootIndex++) {
      const root = roots[rootIndex];
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
      let node;
      while ((node = walker.nextNode())) {
        visitedHosts++;
        if (visitedHosts > REVIEW_SCAN_LIMITS.shadowHostNodes) { truncated = true; break; }
        if (node.shadowRoot) {
          if (roots.length >= REVIEW_SCAN_LIMITS.shadowRoots) { truncated = true; break; }
          roots.push(node.shadowRoot);
        }
      }
      if (visitedHosts > REVIEW_SCAN_LIMITS.shadowHostNodes) break;
    }
    const lightDomLimit = roots.length > 1 ? REVIEW_SCAN_LIMITS.fields - 100 : REVIEW_SCAN_LIMITS.fields;
    for (let rootIndex = 0; rootIndex < roots.length; rootIndex++) {
      const rootLimit = rootIndex === 0 ? lightDomLimit : REVIEW_SCAN_LIMITS.fields;
      for (const el of roots[rootIndex].querySelectorAll(reviewSelector)) {
        if (fields.length >= rootLimit) { truncated = true; break; }
        fields.push(el);
      }
      if (fields.length >= REVIEW_SCAN_LIMITS.fields) { truncated = true; break; }
    }
    return {fields, truncated};
  }
  function embeddedFrameAttention() {
    const attention = [];
    for (const frame of [...document.querySelectorAll('iframe,frame')].filter(isVisible).slice(0, 20)) {
      let url;
      try { url = new URL(frame.getAttribute('src') || location.href, location.href); }
      catch { continue; }
      let containsFields = false;
      try { containsFields = !!frame.contentDocument?.querySelector(reviewSelector); }
      catch {}
      const hint = normalize([frame.title, frame.name, frame.id, url.hostname, url.pathname].join(' '));
      const looksLikeForm = containsFields || /\b(?:apply|application|candidate|career|form|job|workday|greenhouse|lever|icims|taleo|brassring|successfactors|ashby|smartrecruiters)\b/.test(hint);
      if (!looksLikeForm) continue;
      const crossOrigin = url.origin !== location.origin;
      attention.push({
        el: frame,
        label: frame.title?.trim() || `Embedded content from ${url.hostname || 'this page'}`,
        reason: crossOrigin ?
          `Embedded form may require separately trusting ${url.hostname}; it was not accessed` :
          'Form is inside an embedded frame; review it manually'
      });
    }
    return attention;
  }
  function collectReview() {
    const proposals = [], attention = [], seen = new Set(), attentionGroups = new Set();let ignored=0,preserved=0;
    const discovered = discoverReviewElements();
    for (const el of discovered.fields) {
      if (!isVisible(el) || el.readOnly || el.getAttribute('aria-disabled') === 'true' ||
        el.closest('#jk-autofill-panel') || ['hidden','submit','button','reset','password','image'].includes(el.type) && !isCustom(el)) continue;
      if (findIgnoredField(el)){ignored++;continue;}
      if (el.closest('[role="combobox"]') && el.closest('[role="combobox"]') !== el) continue;
      if (seen.has(el)) continue;
      seen.add(el);
      const label = getLabelText(el) || el.getAttribute('aria-label') || el.placeholder || el.name || el.id || 'Unlabeled field';
      const item = {el, label: label.trim().slice(0, 300), ...answerFor(el)};
      const checkboxGroup = sharedCheckboxGroup(el);
      const choiceAnswered = el.type === 'radio' ? peers(el).some(isChecked) :
        checkboxGroup ? peers(el).some(isChecked) : isChoice(el) && isChecked(el);
      if (item.value && el.type !== 'file') {
        if (proposedAnswerIsCurrent(el, item)){preserved++;continue;}
        item.replaceExisting = currentAnswer(el);
        if(!item.matchReason){item.matchReason=item.learned?'Exact remembered field':el.getAttribute('autocomplete')?'Profile rule plus autocomplete':'Built-in profile and label rule';item.confidence=item.learned||el.getAttribute('autocomplete')?'High':'Medium';}
        if (el instanceof HTMLSelectElement && !matchingOption([...el.options], item)) {
          attention.push({...item, reason: 'Saved answer is not an available option'});
        } else if (!candidateFits(el, item.value)) {
          attention.push({...item, reason: el.isContentEditable ?
            'Enter this rich-text field manually' : 'Saved answer does not meet this field’s format or limits'});
        } else proposals.push(item);
      } else if ((isRequired(el) || isEeoQuestion(el) || isConsentQuestion(el)) && !choiceAnswered) {
        const choiceGroup = el.closest('fieldset,[role="radiogroup"],[role="group"]');
        const group = el.type === 'radio' ? choiceGroup : checkboxGroup;
        const groupKey = group || (el.type === 'radio' && el.name ? `${el.form?.id || ''}:${el.name}` : null);
        if (groupKey && attentionGroups.has(groupKey)) continue;
        if (groupKey) attentionGroups.add(groupKey);
        const groupLabel = group?.querySelector('legend')?.textContent?.trim();
        const reason = el.type === 'file' ? 'Choose an upload file' : isRecordDetailsPage() ?
          'Verify this record manually' : /\bminimally acceptable rate of pay\b/.test(directLabel(el)) ?
          'Review the minimum pay for this job' : isConsentQuestion(el) ?
          'Review this agreement manually' : !isRequired(el) && isEeoQuestion(el) ?
          'Optional self-ID; choose whether to answer' : 'Needs your answer';
        attention.push({...item, label: (groupLabel || item.label).slice(0, 300),
          reason});
      }
    }
    attention.push(...embeddedFrameAttention());
    if (discovered.truncated) attention.push({
      el: document.body,
      label: 'Large or deeply nested form',
      reason: `Safety scan limit reached (${REVIEW_SCAN_LIMITS.fields} fields or ${REVIEW_SCAN_LIMITS.shadowRoots} open shadow roots); review remaining fields manually`
    });
    return {proposals, attention, ignored, preserved};
  }
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function chooseCustom(item) {
    const el = item.el;
    const controlRoot = elementRoot(el);
    const listRoots = controlRoot === document ? [document] : [controlRoot, document];
    const visibleLists = () => listRoots.flatMap(root => [...root.querySelectorAll('[role="listbox"]')]).filter(isVisible);
    const before = new Set(visibleLists());
    el.click();
    try {
      for (let attempt = 0; attempt < 12; attempt++) {
        const ids = [el.getAttribute('aria-controls'), el.getAttribute('aria-owns')].filter(Boolean).join(' ').split(/\s+/);
        let lists = ids.map(id => rootElementById(el, id)).filter(node => node && isVisible(node));
        if (!lists.length) lists = visibleLists().filter(node => !before.has(node));
        if (lists.length === 1) {
          const options = [...lists[0].querySelectorAll('[role="option"]')].filter(isVisible);
          const option = matchingOption(options, item);
          if (option) {
            option.click();
            await delay(100);
            return option.getAttribute('aria-selected') === 'true' ||
              !!matchingOption([{textContent: el.value || el.textContent}], item);
          }
        }
        await delay(75);
      }
      return false;
    } finally {
      if (el.getAttribute('aria-expanded') === 'true') {
        el.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape',code:'Escape',bubbles:true}));
        if (el.getAttribute('aria-expanded') === 'true') el.click();
      }
    }
  }
  async function applyReviewed(item) {
    const el = item.el;
    if (!globalThis.__jamieJobAutofill || !el.isConnected || !isVisible(el) || findIgnoredField(el) ||
        (currentAnswer(el) && !item.replaceExisting)) return false;
    const fresh = answerFor(el);
    if (!fresh || fresh.value !== item.value || !candidateFits(el, item.value)) return false;
    if (isChoice(el)) { el.click(); await delay(175); return isChecked(el); }
    if (isCustom(el)) return chooseCustom(item);
    if (el instanceof HTMLSelectElement) {
      const option = matchingOption([...el.options], item);
      if (!option || !setValue(el, option.value)) return false;
      await delay(175);
      return el.value === option.value && option.selected;
    }
    if (!setValue(el, item.value)) return false;
    await delay(175);
    return el.value === String(item.value);
  }
  function validationReason(item) {
    const el=item.el,described=(el?.getAttribute?.('aria-describedby')||'').split(/\s+/).map(id=>rootElementById(el,id)?.textContent||'').join(' ').trim();
    if(el?.getAttribute?.('aria-invalid')==='true')return `Website marked this field invalid${described?`: ${described.slice(0,160)}`:''}`;
    if(el?.validity&&!el.validity.valid)return el.validationMessage||'Browser validation rejected this value';
    if(currentAnswer(el)&&!proposedAnswerIsCurrent(el,item))return 'Website reverted or changed the filled value';
    return 'Could not verify filling; review manually';
  }
  function reportText(value, limit) {
    return normalize(value)
      .replace(/\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi, '[email]')
      .replace(/\b(?:\+?\d[\s().-]*){10,}\b/g, '[phone]')
      .replace(/https?:\/\/\S+/gi, '[url]')
      .slice(0, limit);
  }
  function failureRecord(item) {
    const el = item.el;
    const attributes = {};
    for (const name of ['aria-label','aria-labelledby','aria-describedby','aria-required','aria-invalid','aria-haspopup','aria-expanded','aria-controls','role','autocomplete','inputmode']) {
      const value = el?.getAttribute?.(name);
      if (value) attributes[name] = reportText(value, 160);
    }
    return {
      fieldType: normalize(el?.type || el?.getAttribute?.('role') || el?.tagName || 'unknown').slice(0, 80),
      label: reportText(item.label, 240),
      hostname: location.hostname,
      reason: reportText(item.reason || 'Needs manual review', 240),
      aria: attributes
    };
  }
  function downloadFailureReport(items) {
    const unique = [...new Map(items.map(item => [JSON.stringify(failureRecord(item)), item])).values()];
    const report = {format:'firefox-form-filler-failure-report',schemaVersion:1,createdAt:new Date().toISOString(),
      privacy:'Contains structural field metadata only; no entered answers, cookies, storage, or page HTML.',
      hostname:location.hostname,failures:unique.map(failureRecord)};
    const url = URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
    const link = document.createElement('a');link.href=url;
    link.download=`form-failure-${location.hostname}-${new Date().toISOString().slice(0,10)}.private.json`;
    document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
  function showReview() {
    document.getElementById('jk-review-host')?.remove();
    const host = document.createElement('div');
    host.id = 'jk-review-host';
    host.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:2147483647';
    const root = host.attachShadow({mode:'closed'});
    const style = document.createElement('style');
    style.textContent = ':host{all:initial}section{width:min(480px,90vw);max-height:80vh;overflow:auto;background:white;color:#17233b;border:1px solid #ccd4e0;border-radius:12px;padding:18px;box-shadow:0 8px 32px #0004;font:14px/1.45 system-ui}h2{margin:0 0 8px}button{cursor:pointer;padding:8px 12px;margin:5px;border:1px solid #bcc8da;border-radius:6px;background:#edf2fa;color:#17233b}label{display:block;border-bottom:1px solid #ddd;padding:10px 0}small{display:block;color:#546078;white-space:pre-wrap}input{margin-right:8px}#apply{background:#194e9e;color:white}';
    root.appendChild(style);
    const box = document.createElement('section'); root.appendChild(box);
    const title = document.createElement('h2'); title.textContent = 'Review before filling'; box.appendChild(title);
    const note = document.createElement('p'); note.textContent = 'Uncheck any answer you do not want filled. Custom dropdown options are checked when you apply. Review each job’s minimum requirements.'; box.appendChild(note);
    const close = document.createElement('button'); close.textContent = 'Close'; close.onclick = () => host.remove(); box.appendChild(close);
    const copy = document.createElement('button'); copy.textContent = 'Copy saved answers'; copy.onclick = () => {host.remove();openPanel();}; box.appendChild(copy);
    const {proposals, attention, ignored, preserved} = collectReview();
    const selections = proposals.map(item => {
      const row = document.createElement('label'), check = document.createElement('input'); check.type = 'checkbox'; check.checked = !item.replaceExisting;
      row.append(check, document.createTextNode(item.label));
      const answer = document.createElement('small'); answer.textContent = item.value; row.appendChild(answer); box.appendChild(row);
      const why=document.createElement('small');why.textContent=`${item.confidence} confidence · ${item.matchReason}`;row.appendChild(why);
      if (item.replaceExisting) {
        const warning = document.createElement('small'); warning.textContent = 'Already contains an answer — select to replace it.'; row.appendChild(warning);
      }
      return {item,check};
    });
    const result = document.createElement('p'); result.setAttribute('role','status');
    result.textContent = `${proposals.length} proposed · ${preserved} matching answers preserved · ${ignored} ignored · ${attention.length} need attention`; box.appendChild(result);
    const links = document.createElement('div'); box.appendChild(links);
    let reportItems = attention;
    function renderAttention(items) {
      links.replaceChildren();
      for (const item of items) {
        const button = document.createElement('button'); button.textContent = `${item.label} — ${item.reason}`;
        button.onclick = () => { if (!item.el.isConnected) {result.textContent = 'This page changed. Close and reopen the review.'; return;}
          host.style.display = 'none'; item.el.scrollIntoView({behavior:'smooth',block:'center'}); item.el.focus();
          item.el.style.outline = '3px solid #d89b00'; };
        links.appendChild(button);
      }
    }
    renderAttention(attention);
    const report = document.createElement('button'); report.textContent = 'Save privacy-safe failure report';
    report.hidden = !attention.length; report.onclick = () => downloadFailureReport(reportItems); box.appendChild(report);
    const apply = document.createElement('button'); apply.id = 'apply'; apply.textContent = 'Fill selected answers'; apply.disabled = !proposals.length; box.appendChild(apply);
    apply.onclick = async () => {
      apply.disabled = true;
      if (!(await browser.runtime.sendMessage({type:'can-fill'}))) {result.textContent = 'Website access was removed.'; return;}
      let filled = 0; const failures = [], skipped = [];
      for (const {item,check} of selections) {
        check.disabled = true;
        if (!check.checked) {skipped.push({...item,reason:'Skipped in review'});continue;}
        try { if (await applyReviewed(item)) filled++; else failures.push({...item,reason:validationReason(item)}); }
        catch { failures.push({...item,reason:'Could not fill; review manually'}); }
      }
      const remaining = collectReview().attention;
      const needs = [...new Map([...remaining,...failures,...skipped].map(item=>[item.el,item])).values()];
      reportItems = needs;
      report.hidden = !needs.length;
      result.textContent = `${filled} filled and verified · ${skipped.length} preserved or skipped · ${ignored} ignored · ${needs.length} need review`;
      renderAttention(needs);
    };
    document.body.appendChild(host);
  }
  async function fillApplication() {
    try {
      if (!(await browser.runtime.sendMessage({type:'can-fill'}))) {toast('Whitelist this website first.');return;}
      await loadSavedProfile();
      showReview();
    } catch { toast('Could not load your profile. Reopen the extension and try again.'); }
  }

  // One click: fills every answer the review would pre-check, with the same checks, and leaves the rest alone.
  // It never replaces an answer already on the page and never submits; fields that still need a person open the review.
  let fillingNow = false;
  async function fillNow() {
    if (fillingNow) return;
    fillingNow = true;
    try {
      if (!(await browser.runtime.sendMessage({type:'can-fill'}))) {toast('Whitelist this website first.');return;}
      await loadSavedProfile();
      const {proposals} = collectReview();
      let filled = 0, failed = 0;
      for (const item of proposals) {
        if (item.replaceExisting) continue;
        try { if (await applyReviewed(item)) filled++; else failed++; } catch { failed++; }
      }
      const needs = collectReview().attention.length;
      toast(`${filled} filled${failed ? ` · ${failed} could not be filled` : ''}${needs ? ` · ${needs} need your review` : ''}. Nothing was submitted.`);
      if (needs || failed) showReview();
    } catch { toast('Could not fill this page. Reopen the extension and try again.'); }
    finally { fillingNow = false; }
  }
  browser.runtime.onMessage.addListener(message => {
    if (message?.type === 'fill-now') { fillNow(); return Promise.resolve({started: true}); }
    if (message?.type === 'save-to-profile') { showSaveToProfile(); return Promise.resolve({started: true}); }
  });

  // Save what is typed on this page into the profile. Each filled field is matched to a profile answer with the same
  // label rules the fill uses; changed answers are shown first and nothing is saved until you confirm.
  function profileTarget(el) {
    const direct = directLabel(el);
    if (!direct || isRecordDetailsPage() || isConsentQuestion(el) || isSensitive(direct) || isChoice(el)) return null;
    const rule = matchRule(el, direct);
    if (!rule) return null;
    if (rule[0] === phoneValue) return {section: 'profile', key: 'phone'};
    const source = /^\(\)\s*=>\s*(PROFILE|OPTIONAL)\.([A-Za-z0-9]+)\s*$/.exec(Function.prototype.toString.call(rule[0]).trim());
    return source ? {section: source[1] === 'PROFILE' ? 'profile' : 'optional', key: source[2]} : null;
  }
  function profileSaveCandidates() {
    const found = new Map();
    for (const el of discoverReviewElements().fields) {
      if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) continue;
      if (!isVisible(el) || el.readOnly || el.disabled || el.closest('#jk-autofill-panel') || findIgnoredField(el)) continue;
      if (['hidden', 'submit', 'button', 'reset', 'password', 'image', 'file', 'checkbox', 'radio'].includes(el.type)) continue;
      if (isMemoryUnsafe(el)) continue;
      const target = profileTarget(el);
      const store = target && (target.section === 'profile' ? PROFILE : OPTIONAL);
      if (!target || typeof store[target.key] !== 'string') continue;
      const chosen = el instanceof HTMLSelectElement ? el.selectedOptions[0] : null;
      const value = String(el instanceof HTMLSelectElement ? (chosen?.value ? chosen.textContent : '') : el.value).trim();
      if (!value || value.length > 500) continue;
      const id = `${target.section}.${target.key}`;
      const current = String(store[target.key] || '').trim();
      if (found.has(id) || normalize(current) === normalize(value)) continue;
      // Some pages repeat the label text twice ("Name * Name *"); show it once.
      const words = (getLabelText(el) || el.name || target.key).trim().split(/\s+/);
      const half = words.length / 2;
      const once = Number.isInteger(half) && half > 0 && words.slice(0, half).join(' ') === words.slice(half).join(' ') ? words.slice(0, half) : words;
      found.set(id, {...target, value, current, label: once.join(' ').slice(0, 120)});
    }
    return [...found.values()];
  }
  async function saveToProfile(changes) {
    const saved = await browser.storage.local.get(['jamieProfile', 'profileVariants', 'activeProfileVariant']);
    const apply = data => {
      const next = {...data, profile: {...(data?.profile || {})}, optional: {...(data?.optional || {})}};
      for (const change of changes) next[change.section][change.key] = change.value;
      return next;
    };
    const update = {jamieProfile: apply(saved.jamieProfile)};
    if (Array.isArray(saved.profileVariants)) {
      update.profileVariants = saved.profileVariants.map(item => item?.id === saved.activeProfileVariant ? {...item, data: apply(item.data)} : item);
    }
    await browser.storage.local.set(update);
    for (const change of changes) (change.section === 'profile' ? PROFILE : OPTIONAL)[change.key] = change.value;
  }
  async function showSaveToProfile() {
    try {
      if (!(await browser.runtime.sendMessage({type:'can-fill'}))) {toast('Whitelist this website first.'); return;}
      await loadSavedProfile();
      const changes = profileSaveCandidates();
      if (!changes.length) {toast('Nothing new to save: the answers on this page already match your profile.'); return;}
      document.getElementById('jk-save-profile-host')?.remove();
      const host = document.createElement('div');
      host.id = 'jk-save-profile-host';
      host.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:2147483647';
      const root = host.attachShadow({mode: 'closed'});
      const style = document.createElement('style');
      style.textContent = ':host{all:initial}section{width:min(480px,90vw);max-height:80vh;overflow:auto;background:white;color:#17233b;' +
        'border:1px solid #ccd4e0;border-radius:12px;padding:18px;box-shadow:0 8px 32px #0003;font:14px/1.45 system-ui,sans-serif}' +
        'h2{margin:0 0 8px;font-size:18px}label{display:block;margin:8px 0}small{display:block;color:#536078;margin-left:24px;' +
        'overflow-wrap:anywhere}button{margin:10px 8px 0 0;padding:9px 14px;border:0;border-radius:8px;cursor:pointer;font:inherit;' +
        'background:#194e9e;color:#fff}button.secondary{background:#e6ebf3;color:#17233b}button:disabled{opacity:.5}';
      root.appendChild(style);
      const box = document.createElement('section');
      root.appendChild(box);
      const title = document.createElement('h2');
      title.textContent = 'Save these answers to your profile?';
      box.appendChild(title);
      const note = document.createElement('p');
      note.textContent = 'Only answers that differ from your saved profile are listed. Untick any you do not want saved. Nothing is submitted.';
      box.appendChild(note);
      const rows = changes.map(change => {
        const row = document.createElement('label');
        const check = document.createElement('input');
        check.type = 'checkbox';
        check.checked = true;
        row.append(check, document.createTextNode(` ${change.label}`));
        const detail = document.createElement('small');
        detail.textContent = change.current ? `${change.current} → ${change.value}` : `(empty) → ${change.value}`;
        row.appendChild(detail);
        box.appendChild(row);
        return {change, check};
      });
      const result = document.createElement('p');
      result.setAttribute('role', 'status');
      box.appendChild(result);
      const save = document.createElement('button');
      save.textContent = 'Save selected to profile';
      save.onclick = async () => {
        const chosen = rows.filter(({check}) => check.checked).map(({change}) => change);
        if (!chosen.length) {result.textContent = 'Nothing is ticked.'; return;}
        save.disabled = true;
        try {
          await saveToProfile(chosen);
          result.textContent = `Saved ${chosen.length} answer${chosen.length === 1 ? '' : 's'} to your profile.`;
          setTimeout(() => host.remove(), 1600);
        } catch {
          result.textContent = 'Could not save. Try again.';
          save.disabled = false;
        }
      };
      const close = document.createElement('button');
      close.textContent = 'Close';
      close.className = 'secondary';
      close.onclick = () => host.remove();
      // Collapse to a small pill so the panel never covers part of the page; click the pill to open it again.
      const pill = document.createElement('button');
      pill.textContent = 'Save answers ▴';
      pill.style.cssText = 'display:none;margin:0;border-radius:20px;box-shadow:0 4px 18px #0003';
      const fold = document.createElement('button');
      fold.textContent = 'Collapse';
      fold.className = 'secondary';
      const setCollapsed = collapsed => { box.style.display = collapsed ? 'none' : ''; pill.style.display = collapsed ? 'block' : 'none'; };
      fold.onclick = () => setCollapsed(true);
      pill.onclick = () => setCollapsed(false);
      box.append(save, fold, close);
      root.appendChild(pill);
      document.body.appendChild(host);
    } catch { toast('Could not read this page. Reopen the extension and try again.'); }
  }

  function copyText(
    text,
    label
  ) {
    navigator.clipboard
      .writeText(text)
      .then(
        () =>
          toast(
            `${label} copied.`
          ),
        () =>
          window.prompt(
            `Copy ${label}:`,
            text
          )
      );
  }

  function formatJob(job) {
    return (
      `${job.title} — ${job.employer}\n` +
      `${job.location}\n` +
      `${job.start} – ${job.end}\n` +
      `${job.description}`
    );
  }

  function formatEducation(
    school
  ) {
    return (
      `${school[0]}\n` +
      `${school[1]}\n` +
      `${school[2]}, ${school[3]}`
    );
  }

  function openPanel() {
    let panel =
      document.getElementById(
        'jk-autofill-panel'
      );

    if (panel) {
      panel.style.display =
        'block';

      return;
    }

    panel =
      document.createElement(
        'div'
      );

    panel.id =
      'jk-autofill-panel';

    setStaticHtml(panel, `
      <div class="jk-head">
        <strong>Job Autofill</strong>
        <button type="button" data-close>×</button>
      </div>

      <button
        type="button"
        data-fill
        class="jk-primary"
      >
        Fill this page
      </button>

      <button
        type="button"
        data-highlight
      >
        Highlight unanswered required
      </button>

      <hr>

      <small>
        COPY COMMON ANSWERS
      </small>

      <button
        type="button"
        data-copy="summary"
      >
        Professional summary
      </button>

      <button
        type="button"
        data-copy="skills"
      >
        Technical skills
      </button>

      <button
        type="button"
        data-copy="contact"
      >
        Contact + links
      </button>

      <hr>

      <small>
        WORK HISTORY
      </small>

      <span data-job-buttons></span>

      <hr>

      <small>
        EDUCATION
      </small>

      <span data-school-buttons></span>

      <p>
        Never submits the form.
        Veteran status uses your chosen answer.
        Other sensitive self-ID questions are left for you.
      </p>
    `);

    const jobButtons = panel.querySelector('[data-job-buttons]');
    PROFILE.jobs.forEach((job, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.job = String(index);
      button.textContent = `Job ${index + 1}`;
      jobButtons.appendChild(button);
    });

    const schoolButtons = panel.querySelector('[data-school-buttons]');
    PROFILE.education.forEach((school, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.school = String(index);
      button.textContent = `School ${index + 1}`;
      schoolButtons.appendChild(button);
    });

    const style =
      document.createElement(
        'style'
      );

    style.id = 'jk-panel-style';
    style.textContent = `
      #jk-autofill-launcher {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 2147483646;
        border: 0;
        border-radius: 999px;
        padding: 11px 16px;
        background: #222;
        color: #fff;
        font: 600 14px Arial, sans-serif;
        cursor: pointer;
        box-shadow: 0 4px 18px #0003;
      }

      #jk-autofill-panel {
        position: fixed;
        right: 18px;
        bottom: 70px;
        z-index: 2147483647;
        width: min(
          330px,
          calc(100vw - 36px)
        );
        max-height: 70vh;
        overflow: auto;
        background: #fff;
        color: #222;
        border: 1px solid #ddd;
        border-radius: 10px;
        padding: 12px;
        box-shadow: 0 8px 32px #0004;
        font: 14px Arial, sans-serif;
      }

      #jk-autofill-panel .jk-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
      }

      #jk-autofill-panel button {
        display: block;
        width: 100%;
        margin: 5px 0;
        padding: 8px;
        border: 1px solid #d5d5d5;
        border-radius: 6px;
        background: #f7f7f7;
        color: #222;
        text-align: left;
        cursor: pointer;
      }

      #jk-autofill-panel button[data-close] {
        width: auto;
        border: 0;
        background: transparent;
        font-size: 20px;
        padding: 0 5px;
      }

      #jk-autofill-panel .jk-primary {
        background: #222;
        color: #fff;
        text-align: center;
        font-weight: 700;
      }

      #jk-autofill-panel small {
        font-weight: 700;
      }

      #jk-autofill-panel p {
        font-size: 11px;
        color: #666;
      }

      #jk-autofill-toast {
        position: fixed;
        left: 50%;
        bottom: 20px;
        transform: translateX(-50%);
        z-index: 2147483647;
        background: #222;
        color: #fff;
        padding: 10px 14px;
        border-radius: 7px;
        font: 13px Arial, sans-serif;
      }
    `;

    document.head.appendChild(
      style
    );

    document.body.appendChild(
      panel
    );

    panel.addEventListener(
      'click',
      (event) => {
        const button =
          event.target.closest(
            'button'
          );

        if (!button) {
          return;
        }

        if (
          button.hasAttribute(
            'data-close'
          )
        ) {
          panel.style.display =
            'none';
        }

        else if (
          button.hasAttribute(
            'data-fill'
          )
        ) {
          fillApplication(
            true
          );
        }

        else if (
          button.hasAttribute(
            'data-highlight'
          )
        ) {
          highlightRequired();

          toast(
            'Unanswered required fields highlighted.'
          );
        }

        else if (
          button.dataset.copy ===
          'summary'
        ) {
          copyText(
            PROFILE.summary,
            'summary'
          );
        }

        else if (
          button.dataset.copy ===
          'skills'
        ) {
          copyText(
            PROFILE.skills,
            'skills'
          );
        }

        else if (
          button.dataset.copy ===
          'contact'
        ) {
          copyText(
            [
              PROFILE.fullName,
              PROFILE.email,
              PROFILE.phone,
              PROFILE.portfolio,
              PROFILE.linkedin,
              `${PROFILE.city}, ${PROFILE.state}`
            ].join('\n'),
            'contact information'
          );
        }

        else if (
          button.dataset.job !==
          undefined
        ) {
          const job =
            PROFILE.jobs[
              Number(
                button.dataset.job
              )
            ];

          copyText(
            formatJob(job),
            job.employer
          );
        }

        else if (
          button.dataset.school !==
          undefined
        ) {
          const school =
            PROFILE.education[
              Number(
                button.dataset.school
              )
            ];

          copyText(
            formatEducation(
              school
            ),
            school[0]
          );
        }
      }
    );
  }

  loadSavedProfile().catch(() => {});
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.jamieProfile || changes.learnedFields || changes.ignoredFields || changes.siteMappings || changes.settings)) {
      loadSavedProfile().then(() => activeMemoryField && updateMemoryControl(activeMemoryField)).catch(() => {});
    }
  });
  // The extension's own fixed markup (the field memory menu and the Review panel), put into an element. Pages that
  // require Trusted Types (Microsoft Forms, Google) refuse a plain string for innerHTML, which stopped the extension
  // there. The page's policies are not usable, so a policy of its own is tried; where the page does not allow that, the
  // markup is built from elements.
  let htmlPolicy;
  function setStaticHtml(el, html) {
    try { el.innerHTML = html; return; } catch {}
    try {
      htmlPolicy = htmlPolicy || globalThis.trustedTypes?.createPolicy('jk-autofill', {createHTML: value => value});
      if (htmlPolicy) { el.innerHTML = htmlPolicy.createHTML(html); return; }
    } catch {}
    const fragment = document.createDocumentFragment();
    const stack = [fragment];
    const token = /<(\/?)([a-z][a-z0-9]*)((?:[^<>"']|"[^"]*"|'[^']*')*)>|([^<]+)/gi;
    let match;
    while ((match = token.exec(html))) {
      const [, closing, tag, attributes, text] = match;
      const parent = stack[stack.length - 1];
      if (text !== undefined) {
        if (text.trim()) parent.appendChild(document.createTextNode(text.replace(/\s+/g, ' ')));
      } else if (closing) {
        if (stack.length > 1) stack.pop();
      } else {
        const node = document.createElement(tag.toLowerCase());
        for (const [, name, quoted] of attributes.matchAll(/([a-z][\w:-]*)(?:\s*=\s*"([^"]*)")?/gi)) node.setAttribute(name, quoted ?? '');
        parent.appendChild(node);
        if (!/^(?:hr|br|img|input)$/i.test(tag)) stack.push(node);
      }
    }
    el.replaceChildren(fragment);
  }

  let toastTimer;

  function toast(message) {
    let node =
      document.getElementById(
        'jk-autofill-toast'
      );

    if (!node) {
      node =
        document.createElement(
          'div'
        );

      node.id =
        'jk-autofill-toast';

      document.body.appendChild(
        node
      );
    }

    node.textContent =
      message;

    node.style.display =
      'block';

    clearTimeout(
      toastTimer
    );

    toastTimer =
      setTimeout(
        () => {
          node.style.display =
            'none';
        },
        3200
      );
  }

  function init() {
    if (destroyed || !document.body) return;
    if (
      document.getElementById(
        'jk-autofill-launcher'
      )
    ) {
      return;
    }

    const button =
      document.createElement(
        'button'
      );

    button.id =
      'jk-autofill-launcher';

    button.type =
      'button';

    button.textContent =
      'Review & Fill';
    button.title = 'Preview your answers before filling';
    button.addEventListener('contextmenu', event => { event.preventDefault(); openPanel(); });

    button.addEventListener(
      'click',
      () => { fillApplication(); }
    );

    document.body.appendChild(
      button
    );
    if (!document.getElementById('jk-autofill-now')) {
      const now = document.createElement('button');
      now.id = 'jk-autofill-now';
      now.type = 'button';
      now.textContent = 'Autofill page';
      now.title = 'Fill every answer it is sure about in one click. Nothing is submitted.';
      now.style.cssText = 'position:fixed!important;right:18px!important;bottom:70px!important;z-index:2147483646!important;' +
        'padding:12px 18px!important;border:0!important;border-radius:24px!important;background:#2f7d45!important;' +
        'color:#fff!important;font:600 14px system-ui,sans-serif!important;box-shadow:0 4px 18px #0003!important;cursor:pointer!important;';
      now.addEventListener('click', () => { fillNow(); });
      document.body.appendChild(now);
    }
    if (!document.getElementById('jk-save-profile')) {
      const keep = document.createElement('button');
      keep.id = 'jk-save-profile';
      keep.type = 'button';
      keep.textContent = 'Save answers to profile';
      keep.title = 'Fill the form in yourself, then save the answers you typed into your profile.';
      keep.style.cssText = 'position:fixed!important;right:18px!important;bottom:122px!important;z-index:2147483646!important;' +
        'padding:12px 18px!important;border:0!important;border-radius:24px!important;background:#6b4fa3!important;' +
        'color:#fff!important;font:600 14px system-ui,sans-serif!important;box-shadow:0 4px 18px #0003!important;cursor:pointer!important;';
      keep.addEventListener('click', () => { showSaveToProfile(); });
      document.body.appendChild(keep);
    }
    if (!document.getElementById('jk-menu-toggle')) {
      // Folds the three buttons away so they never cover part of the page; remembered for next time.
      const fold = document.createElement('button');
      fold.id = 'jk-menu-toggle';
      fold.type = 'button';
      const show = collapsed => {
        document.documentElement.toggleAttribute('data-jk-collapsed', collapsed);
        fold.textContent = collapsed ? '+' : '–';
        fold.title = collapsed ? 'Show the autofill buttons' : 'Hide the autofill buttons';
        try { localStorage.setItem('jk-menu-collapsed', collapsed ? '1' : ''); } catch {}
      };
      let saved = false;
      try { saved = localStorage.getItem('jk-menu-collapsed') === '1'; } catch {}
      show(saved);
      // Drag the grey button to move all of the buttons; a plain click folds or unfolds them.
      const place = (dx, dy) => {
        const x = Math.min(0, Math.max(dx, 80 - window.innerWidth)), y = Math.min(0, Math.max(dy, 80 - window.innerHeight));
        document.documentElement.style.setProperty('--jk-dx', `${x}px`);
        document.documentElement.style.setProperty('--jk-dy', `${y}px`);
        return [x, y];
      };
      let offset = [0, 0];
      try { offset = JSON.parse(localStorage.getItem('jk-menu-offset') || '[0,0]'); } catch {}
      offset = place(Number(offset[0]) || 0, Number(offset[1]) || 0);
      let drag = null;
      fold.addEventListener('pointerdown', event => {
        drag = {x: event.clientX, y: event.clientY, start: offset, moved: false};
        fold.setPointerCapture(event.pointerId);
      });
      fold.addEventListener('pointermove', event => {
        if (!drag) return;
        const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
        if (!drag.moved && Math.hypot(dx, dy) < 5) return;
        drag.moved = true;
        offset = place(drag.start[0] + dx, drag.start[1] + dy);
      });
      fold.addEventListener('pointerup', () => {
        if (drag?.moved) { try { localStorage.setItem('jk-menu-offset', JSON.stringify(offset)); } catch {} }
        else if (drag) show(!document.documentElement.hasAttribute('data-jk-collapsed'));
        drag = null;
      });
      document.body.appendChild(fold);
      const close = document.createElement('button');
      close.id = 'jk-menu-close';
      close.type = 'button';
      close.textContent = '×';
      close.title = 'Remove these buttons from this page (reload the page to bring them back)';
      close.addEventListener('click', () => {
        launcherObserver?.disconnect();
        clearTimeout(launcherRepairTimer);
        ['jk-autofill-launcher', 'jk-autofill-now', 'jk-save-profile', 'jk-menu-toggle', 'jk-menu-close']
          .forEach(id => document.getElementById(id)?.remove());
      });
      document.body.appendChild(close);
    }
    installMemoryFieldUI();
    if (!launcherObserver) {
      launcherObserver = new MutationObserver(() => {
        if (destroyed || document.getElementById('jk-autofill-launcher') || launcherRepairTimer) return;
        launcherRepairTimer = setTimeout(() => {
          launcherRepairTimer = null;
          if (!destroyed && !document.getElementById('jk-autofill-launcher')) init();
        }, 300);
      });
      launcherObserver.observe(document.documentElement, {childList:true, subtree:true});
    }
  }

  /*
   * Tampermonkey menu commands
   */

  if (
    typeof GM_registerMenuCommand ===
    'function'
  ) {
    GM_registerMenuCommand(
      'Fill current application page',
      () =>
        fillApplication(
          true
        )
    );

    GM_registerMenuCommand(
      'Open autofill panel',
      openPanel
    );

    GM_registerMenuCommand(
      'Highlight unanswered required fields',
      highlightRequired
    );
  }

  if (
    document.readyState ===
    'loading'
  ) {
    document.addEventListener(
      'DOMContentLoaded',
      init,
      {
        once: true
      }
    );
  } else {
    init();
  }
})();
