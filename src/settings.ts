import {
    PluginSettingTab,
    Setting,
    App,
    ButtonComponent,
    Modal,
    TextComponent,
    Notice
} from "obsidian";
import {
    Admonition,
    AdmonitionIconDefinition,
    AdmonitionIconName,
    AdmonitionIconType,
    ObsidianAdmonitionPlugin
} from "./@types";

import { getIconNode, getIconType, WARNING_ICON } from "./util";

import { ADD_COMMAND_NAME, REMOVE_COMMAND_NAME } from "./util";

import { IconSuggestionModal } from "./modal";

//@ts-expect-error
import CONTENT from "../publish/publish.admonition.txt";
import { t } from "src/lang/helpers";

/** Taken from https://stackoverflow.com/questions/34849001/check-if-css-selector-is-valid/42149818 */
const isSelectorValid = ((dummyElement) => (selector: string) => {
    try {
        dummyElement.querySelector(selector);
    } catch {
        return false;
    }
    return true;
})(document.createDocumentFragment());

export default class AdmonitionSetting extends PluginSettingTab {
    plugin: ObsidianAdmonitionPlugin;
    additionalEl: HTMLDivElement;
    constructor(app: App, plugin: ObsidianAdmonitionPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    async display(): Promise<void> {
        let { containerEl } = this;

        containerEl.empty();
        containerEl.addClass("admonition-settings");
        containerEl.createEl("h2", { text: t("Admonition Settings") });

        let syntax = new Setting(containerEl)
            .setDesc(
                t(
                    "Use Obsidian's markdown syntax highlighter in admonition code blocks. This setting is experimental and could cause errors."
                )
            )
            .addToggle((t) => {
                t.setValue(this.plugin.data.syntaxHighlight);
                t.onChange(async (v) => {
                    this.plugin.data.syntaxHighlight = v;
                    if (v) {
                        this.plugin.turnOnSyntaxHighlighting();
                    } else {
                        this.plugin.turnOffSyntaxHighlighting();
                    }
                    await this.plugin.saveSettings();
                });
            });
        let name = syntax.nameEl.createDiv();
        name.appendChild(WARNING_ICON.cloneNode(true));
        name.appendChild(
            createSpan({ text: t(" Markdown Syntax Highlighting") })
        );

        let sync = new Setting(containerEl)
            .setDesc(
                t(
                    "Try to sync internal links to the metadata cache to display in graph view. This setting could have unintended consequences. Use at your own risk."
                )
            )
            .addToggle((t) => {
                t.setValue(this.plugin.data.syncLinks).onChange(async (v) => {
                    this.plugin.data.syncLinks = v;
                    this.display();
                    await this.plugin.saveSettings();
                });
            });

        let syncName = sync.nameEl.createDiv();
        syncName.appendChild(WARNING_ICON.cloneNode(true));
        syncName.appendChild(
            createSpan({ text: t(" Sync Links to Metadata Cache") })
        );

        let markdown = new Setting(containerEl)
            /* .setDesc(
                "Allows admonitions to be created using `!!! ad-<type>` or `??? ad-<type>`, instead of using a code block."
            ) */
            .addToggle((t) => {
                t.setValue(this.plugin.data.enableMarkdownProcessor).onChange(
                    async (v) => {
                        this.plugin.data.enableMarkdownProcessor = v;
                        if (v) {
                            this.plugin.enableMarkdownProcessor();
                        } else {
                            this.plugin.disableMarkdownProcessor();
                        }
                        this.display();
                        await this.plugin.saveSettings();
                    }
                );
            });
        markdown.descEl.createSpan({
            text: t("Allows admonitions to be created using ")
        });
        markdown.descEl.createEl("code", { text: "!!! ad-<type>" });
        markdown.descEl.createSpan({
            text: t(" or ")
        });
        markdown.descEl.createEl("code", { text: "??? ad-<type>" });
        markdown.descEl.createSpan({
            text: t(", instead of using a code block.")
        });
        let markdownName = markdown.nameEl.createDiv();
        markdownName.appendChild(WARNING_ICON.cloneNode(true));
        markdownName.appendChild(
            createSpan({ text: t(" Enable Non-codeblock Admonitions") })
        );

        const publish = new Setting(containerEl)
            .setName("Generate JS for Publish")
            .setDesc(
                createFragment((f) => {
                    f.createSpan({
                        text: "Generate a javascript file to place in your "
                    });
                    f.createEl("code", { text: "publish.js" });
                    f.createSpan({ text: "file." });
                    f.createEl("br");
                    f.createEl("strong", {
                        text: "Please note that this can only be done on self-hosted publish sites."
                    });
                })
            )
            .addButton((b) => {
                b.setButtonText("Generate");
                b.onClick((evt) => {
                    const admonition_icons: {
                        [admonition_type: string]: {
                            icon: string;
                            color: string;
                        };
                    } = {};

                    for (let key in this.plugin.admonitions) {
                        const value = this.plugin.admonitions[key];

                        admonition_icons[key] = {
                            icon: getIconNode(value.icon).outerHTML,
                            color: value.color
                        };
                    }

                    const js = CONTENT.replace(
                        "const ADMONITION_ICON_MAP = {}",
                        "const ADMONITION_ICON_MAP = " +
                            JSON.stringify(admonition_icons)
                    );
                    let csvFile = new Blob([js], {
                        type: "text/javascript"
                    });
                    let downloadLink = document.createElement("a");
                    downloadLink.download = "publish.admonition.js";
                    downloadLink.href = window.URL.createObjectURL(csvFile);
                    downloadLink.style.display = "none";
                    document.body.appendChild(downloadLink);
                    downloadLink.click();
                    document.body.removeChild(downloadLink);
                });
            });

        const collapeSetting = new Setting(containerEl)
            .setName(t("Collapsible by Default"))

            .addToggle((t) => {
                t.setValue(this.plugin.data.autoCollapse).onChange(
                    async (v) => {
                        this.plugin.data.autoCollapse = v;
                        this.display();
                        await this.plugin.saveSettings();
                    }
                );
            });
        collapeSetting.descEl.createSpan({
            text: t("All admonitions will be collapsible by default. Use ")
        });
        collapeSetting.descEl.createEl("code", { text: "collapse: none" });
        collapeSetting.descEl.createSpan({
            text: t(" to prevent.")
        });
        if (this.plugin.data.autoCollapse) {
            new Setting(containerEl)
                .setName(t("Default Collapse Type"))
                .setDesc(
                    t(
                        "Collapsible admonitions will be either opened or closed."
                    )
                )
                .addDropdown((d) => {
                    d.addOption("open", "open");
                    d.addOption("closed", "closed");
                    d.setValue(this.plugin.data.defaultCollapseType);
                    d.onChange(async (v: "open" | "closed") => {
                        this.plugin.data.defaultCollapseType = v;
                        await this.plugin.saveSettings();
                    });
                });
        }
        new Setting(containerEl)
            .setName(t("Add Copy Button"))
            .setDesc(t("Add a 'copy content' button to admonitions."))
            .addToggle((t) => {
                t.setValue(this.plugin.data.copyButton);
                t.onChange(async (v) => {
                    this.plugin.data.copyButton = v;

                    if (!v) {
                        document
                            .querySelectorAll(".admonition-content-copy")
                            .forEach((el) => {
                                el.detach();
                            });
                    }

                    await this.plugin.saveSettings();
                });
            });
        new Setting(containerEl)
            .setName(t("Parse Titles as Markdown"))
            .setDesc(t("Admonition Titles will be rendered as markdown."))
            .addToggle((t) => {
                t.setValue(this.plugin.data.parseTitles);
                t.onChange(async (v) => {
                    this.plugin.data.parseTitles = v;

                    await this.plugin.saveSettings();
                });
            });

        new Setting(containerEl)
            .setName("Set Admonition Colors")
            .setDesc(
                "Disable this setting to turn off admonition coloring by default. Can be overridden in the admonition definition."
            )
            .addToggle((t) =>
                t
                    .setValue(this.plugin.data.injectColor)
                    .setTooltip(
                        `${
                            this.plugin.data.injectColor ? "Disable" : "Enable"
                        } Admonition Color`
                    )
                    .onChange(async (v) => {
                        this.plugin.data.injectColor = v;

                        await this.plugin.saveSettings();

                        await this.buildTypes();
                    })
            );

        const additionalContainer = containerEl.createDiv(
            "admonition-setting-additional-container"
        );
        new Setting(additionalContainer)
            .setName(t("Add New"))
            .setDesc(t("Add a new Admonition type."))
            .addButton((button: ButtonComponent): ButtonComponent => {
                let b = button
                    .setTooltip(t("Add Additional"))
                    .setButtonText("+")
                    .onClick(async () => {
                        let modal = new SettingsModal(this.plugin);

                        modal.onClose = async () => {
                            if (modal.saved) {
                                this.plugin.addAdmonition({
                                    type: modal.type,
                                    color: modal.color,
                                    icon: modal.icon,
                                    command: false,
                                    title: modal.title,
                                    injectColor: modal.injectColor,
                                    noTitle: modal.noTitle,
                                    copy: modal.copy
                                });
                                this.display();
                            }
                        };

                        modal.open();
                    });

                return b;
            });

        this.additionalEl = additionalContainer.createDiv("additional");
        await this.buildTypes();

        const div = containerEl.createDiv("coffee");
        div.createEl("a", {
            href: "https://www.buymeacoffee.com/valentine195"
        }).createEl("img", {
            attr: {
                src: "https://img.buymeacoffee.com/button-api/?text=Buy me a coffee&emoji=☕&slug=valentine195&button_colour=e3e7ef&font_colour=262626&font_family=Inter&outline_colour=262626&coffee_colour=ff0000"
            }
        });
    }
    async buildTypes() {
        this.additionalEl.empty();
        for (let a in this.plugin.data.userAdmonitions) {
            const admonition = this.plugin.data.userAdmonitions[a];

            let setting = new Setting(this.additionalEl);

            let admonitionElement = this.plugin.getAdmonitionElement(
                admonition.type,
                admonition.type[0].toUpperCase() +
                    admonition.type.slice(1).toLowerCase(),
                admonition.icon,
                admonition.injectColor ?? this.plugin.data.injectColor
                    ? admonition.color
                    : null
            );
            setting.infoEl.replaceWith(admonitionElement);

            if (!admonition.command) {
                setting.addExtraButton((b) => {
                    b.setIcon(ADD_COMMAND_NAME.toString())
                        .setTooltip(t("Register Commands"))
                        .onClick(async () => {
                            this.plugin.registerCommandsFor(admonition);
                            await this.plugin.saveSettings();
                            this.display();
                        });
                });
            } else {
                setting.addExtraButton((b) => {
                    b.setIcon(REMOVE_COMMAND_NAME.toString())
                        .setTooltip(t("Unregister Commands"))
                        .onClick(async () => {
                            this.plugin.unregisterCommandsFor(admonition);
                            await this.plugin.saveSettings();
                            this.display();
                        });
                });
            }

            setting
                .addExtraButton((b) => {
                    b.setIcon("pencil")
                        .setTooltip(t("Edit"))
                        .onClick(() => {
                            let modal = new SettingsModal(
                                this.plugin,
                                admonition
                            );

                            modal.onClose = async () => {
                                if (modal.saved) {
                                    const hasCommand = admonition.command;
                                    this.plugin.removeAdmonition(admonition);
                                    this.plugin.addAdmonition({
                                        type: modal.type,
                                        color: modal.color,
                                        icon: modal.icon,
                                        command: hasCommand,
                                        title: modal.title,
                                        injectColor: modal.injectColor,
                                        noTitle: modal.noTitle,
                                        copy: modal.copy
                                    });
                                    this.display();
                                }
                            };

                            modal.open();
                        });
                })
                .addExtraButton((b) => {
                    b.setIcon("trash")
                        .setTooltip(t("Delete"))
                        .onClick(() => {
                            this.plugin.removeAdmonition(admonition);
                            this.display();
                        });
                });
        }
    }
}

class SettingsModal extends Modal {
    color: string = "#7d7d7d";
    icon: AdmonitionIconDefinition = {};
    type: string;
    saved: boolean = false;
    error: boolean = false;
    title: string;
    injectColor: boolean = this.plugin.data.injectColor;
    noTitle: boolean = false;
    admonitionPreview: HTMLElement;
    copy: boolean;
    constructor(
        public plugin: ObsidianAdmonitionPlugin,
        admonition?: Admonition
    ) {
        super(plugin.app);
        if (admonition) {
            this.color = admonition.color;
            this.icon = admonition.icon;
            this.type = admonition.type;
            this.title = admonition.title;
            this.injectColor = admonition.injectColor ?? this.injectColor;
            this.noTitle = admonition.noTitle ?? false;
            this.copy = admonition.copy ?? this.plugin.data.copyButton;
        }
    }

    async display() {
        let { contentEl } = this;

        contentEl.empty();

        const settingDiv = contentEl.createDiv();
        const title = this.title ?? this.type ?? "...";

        this.admonitionPreview = this.plugin.getAdmonitionElement(
            this.type,
            title[0].toUpperCase() + title.slice(1).toLowerCase(),
            this.icon,
            this.injectColor ?? this.plugin.data.injectColor ? this.color : null
        );
        this.admonitionPreview.createDiv("admonition-content").createEl("p", {
            text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nulla et euismod nulla."
        });

        contentEl.appendChild(this.admonitionPreview);
        let typeText: TextComponent;
        const typeSetting = new Setting(settingDiv)
            .setName(t("Admonition Type"))
            .addText((text) => {
                typeText = text;
                typeText.setValue(this.type).onChange((v) => {
                    if (!v.length) {
                        SettingsModal.setValidationError(
                            text,
                            t("Admonition type cannot be empty.")
                        );
                        return;
                    }

                    if (v.includes(" ")) {
                        SettingsModal.setValidationError(
                            text,
                            t("Admonition type cannot include spaces.")
                        );
                        return;
                    }

                    if (!isSelectorValid(v)) {
                        SettingsModal.setValidationError(
                            text,
                            t("Types must be a valid CSS selector.")
                        );
                        return;
                    }

                    SettingsModal.removeValidationError(text);

                    this.type = v;
                    if (!this.title)
                        this.updateTitle(this.admonitionPreview, this.type);
                });
            });
        typeSetting.controlEl.addClass("admonition-type-setting");

        typeSetting.descEl.createSpan({
            text: "This is used to create the admonition (e.g.,  "
        });
        typeSetting.descEl.createEl("code", {
            text: "note"
        });
        typeSetting.descEl.createSpan({
            text: " or "
        });
        typeSetting.descEl.createEl("code", {
            text: "abstract"
        });
        typeSetting.descEl.createSpan({
            text: ")"
        });

        new Setting(settingDiv)
            .setName(t("Admonition Title"))
            .setDesc(
                t("This will be the default title for this admonition type.")
            )
            .addText((text) => {
                text.setValue(this.title).onChange((v) => {
                    if (!v.length) {
                        this.title = null;
                        this.updateTitle(this.admonitionPreview, this.type);
                        return;
                    }

                    this.title = v;
                    this.updateTitle(this.admonitionPreview, this.title);
                });
            });
        new Setting(settingDiv)
            .setName(t("No Admonition Title by Default"))
            .setDesc(
                createFragment((e) => {
                    e.createSpan({
                        text: t("The admonition will have no title unless ")
                    });
                    e.createEl("code", { text: "title" });
                    e.createSpan({ text: t(" is explicitly provided.") });
                })
            )
            .addToggle((t) => {
                t.setValue(this.noTitle).onChange((v) => (this.noTitle = v));
            });
        new Setting(settingDiv)
            .setName(t("Show Copy Button"))
            .setDesc(
                createFragment((e) => {
                    e.createSpan({
                        text: t(
                            "A copy button will be added to the admonition."
                        )
                    });
                })
            )
            .addToggle((t) => {
                t.setValue(this.copy).onChange((v) => (this.copy = v));
            });

        const input = createEl("input", {
            attr: {
                type: "file",
                name: "image",
                accept: "image/*"
            }
        });
        let iconText: TextComponent;
        new Setting(settingDiv)
            .setName(t("Admonition Icon"))
            .setDesc(
                createFragment((desc) => {
                    desc.createEl("a", {
                        text: "Font Awesome Icon",
                        href: "https://fontawesome.com/icons?d=gallery&p=2&s=solid&m=free",
                        attr: {
                            tabindex: -1
                        }
                    });
                    desc.createSpan({ text: " or " });
                    desc.createEl("a", {
                        text: "RPG Awesome Icon",
                        href: "https://nagoshiashumari.github.io/Rpg-Awesome/",
                        attr: {
                            tabindex: -1
                        }
                    });
                    desc.createSpan({ text: " to use next to the title." });
                })
            )
            .addText((text) => {
                iconText = text;
                if (this.icon.type !== "image") text.setValue(this.icon.name);

                const validate = async () => {
                    const v = text.inputEl.value;
                    let ic = getIconType(v);
                    if (!ic) {
                        SettingsModal.setValidationError(
                            text,
                            t("Invalid icon name.")
                        );
                        return;
                    }

                    if (v.length == 0) {
                        SettingsModal.setValidationError(
                            text,
                            t("Icon cannot be empty.")
                        );
                        return;
                    }

                    SettingsModal.removeValidationError(text);

                    this.icon = modal.icon ?? {
                        name: v as AdmonitionIconName,
                        type: ic as AdmonitionIconType
                    };

                    let iconEl = this.admonitionPreview.querySelector(
                        ".admonition-title-icon"
                    );

                    iconEl.innerHTML = getIconNode(this.icon).outerHTML;
                };

                const modal = new IconSuggestionModal(this.app, text);

                modal.onClose = validate;

                text.inputEl.onblur = validate;
            })
            .addButton((b) => {
                b.setButtonText(t("Upload Image")).setTooltip(
                    t("Upload Image")
                );
                b.buttonEl.addClass("admonition-file-upload");
                b.buttonEl.appendChild(input);
                b.onClick(() => input.click());
            });

        /** Image Uploader */
        input.onchange = async () => {
            const { files } = input;

            if (!files.length) return;

            const image = files[0];
            const reader = new FileReader();
            reader.onloadend = (evt) => {
                var image = new Image();
                image.onload = () => {
                    try {
                        // Resize the image
                        const canvas = document.createElement("canvas"),
                            max_size = 24;
                        let width = image.width,
                            height = image.height;
                        if (width > height) {
                            if (width > max_size) {
                                height *= max_size / width;
                                width = max_size;
                            }
                        } else {
                            if (height > max_size) {
                                width *= max_size / height;
                                height = max_size;
                            }
                        }
                        canvas.width = width;
                        canvas.height = height;
                        canvas
                            .getContext("2d")
                            .drawImage(image, 0, 0, width, height);

                        this.icon = {
                            name: canvas.toDataURL("image/png"),
                            type: "image"
                        };
                        this.display();
                    } catch (e) {
                        new Notice("There was an error parsing the image.");
                    }
                };
                image.src = evt.target.result.toString();
            };
            reader.readAsDataURL(image);

            input.value = null;
        };

        const color = settingDiv.createDiv("admonition-color-settings");
        this.createColor(color);

        let footerEl = contentEl.createDiv();
        let footerButtons = new Setting(footerEl);
        footerButtons.addButton((b) => {
            b.setTooltip(t("Save"))
                .setIcon("checkmark")
                .onClick(async () => {
                    let error = false;
                    if (!typeText.inputEl.value.length) {
                        SettingsModal.setValidationError(
                            typeText,
                            t("Admonition type cannot be empty.")
                        );
                        error = true;
                    }

                    if (typeText.inputEl.value.includes(" ")) {
                        SettingsModal.setValidationError(
                            typeText,
                            t("Admonition type cannot include spaces.")
                        );
                        error = true;
                    }

                    if (!isSelectorValid(typeText.inputEl.value)) {
                        SettingsModal.setValidationError(
                            typeText,
                            t("Types must be a valid CSS selector.")
                        );
                        error = true;
                    }

                    if (
                        !getIconType(iconText.inputEl.value) &&
                        this.icon.type !== "image"
                    ) {
                        SettingsModal.setValidationError(
                            iconText,
                            t("Invalid icon name.")
                        );
                        error = true;
                    }

                    if (!this.icon.name.length) {
                        SettingsModal.setValidationError(
                            iconText,
                            t("Icon cannot be empty.")
                        );
                        error = true;
                    }

                    if (error) {
                        new Notice("Fix errors before saving.");
                        return;
                    }
                    this.saved = true;
                    this.close();
                });
            return b;
        });
        footerButtons.addExtraButton((b) => {
            b.setIcon("cross")
                .setTooltip("Cancel")
                .onClick(() => {
                    this.saved = false;
                    this.close();
                });
            return b;
        });
    }
    createColor(el: HTMLDivElement) {
        el.empty();
        const desc = this.injectColor
            ? "Set the admonition color. Disable to set manually using CSS."
            : "Admonition color is disabled and must be manually set using CSS.";
        new Setting(el)
            .setName(t("Color"))
            .setDesc(desc)
            .addText((t) => {
                t.inputEl.setAttribute("type", "color");

                if (!this.injectColor) {
                    t.inputEl.setAttribute("disabled", "true");
                }

                t.setValue(rgbToHex(this.color)).onChange((v) => {
                    let color = hexToRgb(v);
                    if (!color) return;
                    this.color = `${color.r}, ${color.g}, ${color.b}`;
                    this.admonitionPreview.setAttribute(
                        "style",
                        `--admonition-color: ${this.color};`
                    );
                });
            })
            .addToggle((t) =>
                t
                    .setValue(this.injectColor)
                    .setTooltip(
                        `${
                            this.injectColor ? "Disable" : "Enable"
                        } Admonition Color`
                    )
                    .onChange((v) => {
                        this.injectColor = v;

                        if (!v) {
                            this.admonitionPreview.removeAttribute("style");
                        } else {
                            this.admonitionPreview.setAttribute(
                                "style",
                                `--admonition-color: ${this.color};`
                            );
                        }

                        this.createColor(el);
                    })
            );
    }
    updateTitle(admonitionPreview: HTMLElement, title: string) {
        let titleSpan = admonitionPreview.querySelector(
            ".admonition-title-content"
        );
        let iconEl = admonitionPreview.querySelector(".admonition-title-icon");
        titleSpan.textContent =
            title[0].toUpperCase() + title.slice(1).toLowerCase();
        titleSpan.prepend(iconEl);
    }
    onOpen() {
        this.display();
    }

    static setValidationError(textInput: TextComponent, message?: string) {
        textInput.inputEl.addClass("is-invalid");
        if (message) {
            textInput.inputEl.parentElement.addClasses([
                "has-invalid-message",
                "unset-align-items"
            ]);
            textInput.inputEl.parentElement.parentElement.addClass(
                ".unset-align-items"
            );
            let mDiv = textInput.inputEl.parentElement.querySelector(
                ".invalid-feedback"
            ) as HTMLDivElement;

            if (!mDiv) {
                mDiv = createDiv({ cls: "invalid-feedback" });
            }
            mDiv.innerText = message;
            mDiv.insertAfter(textInput.inputEl);
        }
    }
    static removeValidationError(textInput: TextComponent) {
        textInput.inputEl.removeClass("is-invalid");
        textInput.inputEl.parentElement.removeClasses([
            "has-invalid-message",
            "unset-align-items"
        ]);
        textInput.inputEl.parentElement.parentElement.removeClass(
            ".unset-align-items"
        );

        if (
            textInput.inputEl.parentElement.querySelector(".invalid-feedback")
        ) {
            textInput.inputEl.parentElement.removeChild(
                textInput.inputEl.parentElement.querySelector(
                    ".invalid-feedback"
                )
            );
        }
    }
}

function hexToRgb(hex: string) {
    let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);

    return result
        ? {
              r: parseInt(result[1], 16),
              g: parseInt(result[2], 16),
              b: parseInt(result[3], 16)
          }
        : null;
}
function componentToHex(c: number) {
    var hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
}
function rgbToHex(rgb: string) {
    let result = /^(\d+),\s?(\d+),\s?(\d+)/i.exec(rgb);
    if (!result || !result.length) {
        return "";
    }
    return `#${componentToHex(Number(result[1]))}${componentToHex(
        Number(result[2])
    )}${componentToHex(Number(result[3]))}`;
}
