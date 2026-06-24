const editor = document.getElementById("editor");

const { invoke } = window.__TAURI__.core;

editor.contentEditable =
    true;

let data = {};

let dirty = false;

let currentDate = getToday();

let hideCompleted = false;

let saveTimer = null;

let currentFocusItem = null;

let focusMap = {};

async function saveMemoToFile() {

    if (!dirty) {
        return;
    }

    cleanupData();

    dirty = false;

    try {

        await invoke(
            "save_memo",
            {
                content:
                    JSON.stringify({
                        currentDate,
                        data
                    })
            }
        );

    } catch (e) {

        console.error(
            "saveMemo失败",
            e
        );
        dirty = true;

    }
}

function isPrimaryModifierPressed(e) {

    return e.ctrlKey || e.metaKey;
}

function getToday() {

    const d = new Date();

    const y = d.getFullYear();

    const m =
        String(
            d.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            d.getDate()
        ).padStart(2, "0");

    return `${y}-${m}-${day}`;
}

function getCurrentItems() {

    const result = [];

    const todayItems =
        ensureTodayItems();

    Object.keys(data).forEach(date => {

        data[date].forEach(item => {

            if (

                item.persistent &&

                date <= currentDate &&

                (
                    !item.persistentEnd ||
                    currentDate < item.persistentEnd
                )

            ) {

                result.push(item);
            }

        });

    });

    todayItems.forEach(item => {

        if (!item.persistent) {

            result.push(item);
        }

    });

    return result;
}

function ensureTodayItems() {

    if (!data[currentDate]) {

        data[currentDate] = [];
    }

    return data[currentDate];
}

function getTodayItems() {

    return ensureTodayItems();
}

function getItemDate(targetItem) {

    const dates =
        Object.keys(data);

    for (const date of dates) {

        if (
            data[date].includes(
                targetItem
            )
        ) {
            return date;
        }
    }

    return null;
}

function getSortableCurrentItems() {

    return getCurrentItems()
        .filter(item => {

            if (item.persistent) {
                return false;
            }

            if (
                hideCompleted &&
                item.completed
            ) {
                return false;
            }

            return true;
        });
}

function updateDateLabel() {

    const dateLabel =
        document.getElementById(
            "dateLabel"
        );

    const d =
        currentDate.split("-");

    dateLabel.textContent =
        `${d[1]}/${d[2]}`;
}

// 保存
function save() {

    dirty = true;

    clearTimeout(saveTimer);

    saveTimer = setTimeout(() => {

        saveMemoToFile();

    }, 1500);

}

function cleanupData() {

    Object.keys(data).forEach(date => {

        const items = data[date];

        const validItems = items.filter((item, index) => {

            const isLastItem =
                index === items.length - 1;

            return !(
                item.text.trim() === "" &&
                !item.completed &&
                !item.starred &&
                !item.persistent &&
                !isLastItem
            );

        });

        const hasMeaningfulItem = validItems.some(item =>
            item.text.trim() !== "" ||
            item.completed ||
            item.starred ||
            item.persistent
        );

        if (!hasMeaningfulItem) {
            delete data[date];
        } else {
            data[date] = validItems;
        }
    });

}

// 光标移动到末尾
function moveCaretToEnd(
    el,
    scroll = true
) {

    editor.focus();

    const range =
        document.createRange();

    range.selectNodeContents(el);

    range.collapse(false);

    const sel =
        window.getSelection();

    sel.removeAllRanges();

    sel.addRange(range);

    if (scroll) {

        el.scrollIntoView({
            block: "nearest",
            inline: "nearest"
        });

    }
}

//滑动动画
function getItemElementFromNode(node) {

    if (!node) {
        return null;
    }

    const el =
        node.nodeType === Node.TEXT_NODE
            ? node.parentElement
            : node;

    if (!el || !el.closest) {
        return null;
    }

    return el.closest(".item");
}


function getActiveItemElement() {

    const sel =
        window.getSelection();

    if (
        !sel.rangeCount ||
        !editor.contains(sel.anchorNode)
    ) {
        return null;
    }

    return getItemElementFromNode(
        sel.anchorNode
    );
}

function getVisibleItemElements() {

    return Array.from(
        editor.querySelectorAll(".item")
    ).filter(el => (
        el.offsetParent !== null
    ));
}

function syncItemsFromDom() {

    const domItems =
        Array.from(
            editor.querySelectorAll(".item")
        );

    const syncedTodayItems = [];

    domItems.forEach(el => {
        if (!el.memoItem) return;

        el.memoItem.text = el.textContent;

        syncedTodayItems.push(el.memoItem);
    });

    data[currentDate] = syncedTodayItems;
}

function getCaretOffset(el) {

    const sel =
        window.getSelection();

    if (
        !sel.rangeCount ||
        !sel.isCollapsed ||
        !el.contains(sel.anchorNode)
    ) {
        return null;
    }

    const range =
        sel.getRangeAt(0)
            .cloneRange();

    const beforeCaret =
        range.cloneRange();

    beforeCaret.selectNodeContents(el);

    beforeCaret.setEnd(
        range.endContainer,
        range.endOffset
    );

    return beforeCaret
        .toString()
        .length;
}

function moveCaretToOffset(
    el,
    offset
) {

    editor.focus();

    const walker =
        document.createTreeWalker(
            el,
            NodeFilter.SHOW_TEXT
        );

    let remaining =
        Math.max(
            0,
            offset
        );

    let node =
        walker.nextNode();

    while (node) {

        if (
            remaining <=
            node.textContent.length
        ) {

            const range =
                document.createRange();

            range.setStart(
                node,
                remaining
            );

            range.collapse(true);

            const sel =
                window.getSelection();

            sel.removeAllRanges();

            sel.addRange(range);

            el.scrollIntoView({
                block: "nearest",
                inline: "nearest"
            });

            return;
        }

        remaining -=
            node.textContent.length;

        node =
            walker.nextNode();
    }

    moveCaretToEnd(el);
}

function moveCaretToNeighborItem(
    currentEl,
    direction
) {

    const items =
        getVisibleItemElements();

    const index =
        items.indexOf(currentEl);

    if (index === -1) {
        return false;
    }

    const target =
        items[
        index + direction
        ];

    if (!target) {
        return false;
    }

    const offset =
        getCaretOffset(currentEl);

    moveCaretToOffset(
        target,
        Math.min(
            offset ?? target.textContent.length,
            target.textContent.length
        )
    );

    return true;
}

function isCaretOnBoundaryLine(
    el,
    direction
) {

    const sel =
        window.getSelection();

    if (
        !sel.rangeCount ||
        !sel.isCollapsed ||
        !el.contains(sel.anchorNode)
    ) {
        return false;
    }

    const range =
        sel.getRangeAt(0);

    const caretRect =
        range.getBoundingClientRect();

    if (
        !caretRect ||
        (
            caretRect.top === 0 &&
            caretRect.bottom === 0
        )
    ) {
        return true;
    }

    const elRect =
        el.getBoundingClientRect();

    const lineHeight =
        parseFloat(
            getComputedStyle(el).lineHeight
        ) || 32;

    if (direction < 0) {
        return (
            caretRect.top <=
            elRect.top + lineHeight / 2
        );
    }

    return (
        caretRect.bottom >=
        elRect.bottom - lineHeight / 2
    );
}

function updateCurrentFocusFromSelection() {

    const active =
        getActiveItemElement();

    if (
        active &&
        active.memoItem
    ) {

        currentFocusItem =
            active.memoItem;

        focusMap[currentDate] =
            active.memoItem;
    }
}

function moveCaretHorizontallyAcrossItems(
    currentEl,
    direction
) {

    const offset =
        getCaretOffset(currentEl);

    if (offset === null) {
        return false;
    }

    if (
        direction < 0 &&
        offset !== 0
    ) {
        return false;
    }

    if (
        direction > 0 &&
        offset !== currentEl.textContent.length
    ) {
        return false;
    }

    const items =
        getVisibleItemElements();

    const index =
        items.indexOf(currentEl);

    const target =
        items[
        index + direction
        ];

    if (!target) {
        return false;
    }

    moveCaretToOffset(
        target,
        direction < 0
            ? target.textContent.length
            : 0
    );

    return true;
}

function playSlide(direction) {

    editor.classList.remove(
        "slide-left",
        "slide-right"
    );

    void editor.offsetWidth;

    editor.classList.add(direction);

    setTimeout(() => {

        editor.classList.remove(
            direction
        );

    }, 250);
}

function createItemElement(
    item
) {

    const div =
        document.createElement(
            "div"
        );

    div.className =
        "item";

    if (item.completed) {
        div.classList.add(
            "completed"
        );
    }

    if (item.persistent) {
        div.classList.add(
            "persistent"
        );
    }

    if (item.starred) {
        div.classList.add(
            "starred"
        );
    }

    div.textContent =
        item.text;

    div.memoItem =
        item;

    return div;
}

// 渲染
function render() {

    const todayItems =
        getTodayItems();

    const visibleNormalItems =
        todayItems.filter(item => {

            if (item.persistent) {
                return false;
            }

            if (
                hideCompleted &&
                item.completed
            ) {
                return false;
            }

            return true;
        });

    if (
        visibleNormalItems.length === 0
    ) {

        todayItems.push({

            text: "",
            completed: false,
            starred: false,

            persistent: false,
            persistentEnd: null

        });
    }

    const items =
        getCurrentItems();

    editor.innerHTML = "";

    items.forEach(item => {

        editor.appendChild(
            createItemElement(item)
        );

    });

    if (
        hideCompleted
    ) {

        editor.classList.add(
            "hide-completed"
        );

    } else {

        editor.classList.remove(
            "hide-completed"
        );
    }

        requestAnimationFrame(() => {

        const visibleItems =
            getVisibleItemElements();

        if (!visibleItems.length) {
            return;
        }

        let targetEl = null;

        if (currentFocusItem) {

            targetEl =
                visibleItems.find(
                    el => el.memoItem === currentFocusItem
                ) || null;

        }

        if (!targetEl) {

            targetEl =
                visibleItems[
                    visibleItems.length - 1
                ];

            currentFocusItem =
                targetEl.memoItem;

        }

        if (targetEl) {

            moveCaretToEnd(
                targetEl,
                false
            );

        }

    });

    updateDateLabel();
}

// 初始化读取
(async function init() {

    const obj = await invoke("load_memo");

    const parsed = JSON.parse(obj);

    currentDate = getToday();
    data = parsed.data || {};

    Object.values(data).forEach(items => {
        items.forEach(item => {

            if (item.persistent === undefined) {
                item.persistent = false;
            }

            if (item.persistentEnd === undefined) {
                item.persistentEnd = null;
            }

        });
    });

    // 确保当天有数据
    getCurrentItems();

    render();

    requestAnimationFrame(() => {

        const items =
            getVisibleItemElements();

        if (!items.length) {
            return;
        }

        moveCaretToEnd(
            items[items.length - 1],
            false
        );

    });

})();

function handleEditorInput() {

    console.log(
        "HTML:",
        editor.innerHTML
    );

    console.log(
        "TEXT:",
        editor.textContent
    );

    syncItemsFromDom();

    updateCurrentFocusFromSelection();

    save();
}

editor.addEventListener(
    "input",
    handleEditorInput
);

editor.addEventListener(
    "beforeinput",
    (e) => {

        console.log(
            "beforeinput",
            e.inputType
        );

        console.log(
            editor.innerHTML
        );

    }
);

editor.addEventListener(
    "keyup",
    updateCurrentFocusFromSelection
);

editor.addEventListener(
    "mouseup",
    updateCurrentFocusFromSelection
);

document.addEventListener(
    "selectionchange",
    updateCurrentFocusFromSelection
);

editor.addEventListener(
    "keydown",
    (e) => {

        const active =
            getActiveItemElement();

        if (!active) {
            return;
        }

        const item =
            active.memoItem;

        if (!item) {
            return;
        }

                syncItemsFromDom();
        updateCurrentFocusFromSelection();

        if (
            !isPrimaryModifierPressed(e) &&
            !e.altKey &&
            !e.shiftKey &&
            (
                e.key === "ArrowLeft" ||
                e.key === "ArrowRight"
            )
        ) {

            const moved =
                moveCaretHorizontallyAcrossItems(
                    active,
                    e.key === "ArrowLeft"
                        ? -1
                        : 1
                );

            if (moved) {
                e.preventDefault();
            }

            return;
        }

        if (
            !isPrimaryModifierPressed(e) &&
            !e.altKey &&
            !e.shiftKey &&
            (
                e.key === "ArrowUp" ||
                e.key === "ArrowDown"
            )
        ) {

            const direction =
                e.key === "ArrowUp"
                    ? -1
                    : 1;

            if (
                !isCaretOnBoundaryLine(
                    active,
                    direction
                )
            ) {
                return;
            }

            const moved =
                moveCaretToNeighborItem(
                    active,
                    direction
                );

            if (moved) {
                e.preventDefault();
            }

            return;
        }

        if (
            item.persistent &&
            e.key === "Enter"
        ) {

            e.preventDefault();

            return;
        }

        if (
            e.key === "Enter"
        ) {

            e.preventDefault();

            syncItemsFromDom();

            if (
                active.textContent.trim() === ""
            ) {
                return;
            }

            const dayItems =
                getTodayItems();

            const hasEmptyItem =
                dayItems.some(i =>
                    i.text.trim() === "" &&
                    !i.completed &&
                    !i.starred &&
                    !i.persistent
                );

            if (hasEmptyItem) {

                currentFocusItem =
                    dayItems.find(i =>
                        i.text.trim() === "" &&
                        !i.completed &&
                        !i.starred &&
                        !i.persistent
                    );

                render();

                return;
            }

            const realIndex =
                dayItems.indexOf(item);

            if (realIndex < 0) {
                return;
            }

            const newItem = {

                text: "",
                completed: false,
                starred: false,

                persistent: false,
                persistentEnd: null

            };

            dayItems.splice(
                realIndex + 1,
                0,
                newItem
            );

            currentFocusItem =
                newItem;

            save();

            render();

            requestAnimationFrame(() => {

                const target =
                    getVisibleItemElements()
                        .find(
                            el =>
                                el.memoItem === newItem
                        );

                if (target) {

                    target.scrollIntoView({
                        block: "nearest",
                        inline: "nearest"
                    });

                }

            });

            return;
        }

        if (
            e.key === "Backspace" &&
            active.textContent.trim() === ""
        ) {

            e.preventDefault();

            const dayItems =
                getTodayItems();

            const realIndex =
                dayItems.indexOf(item);

            if (
                realIndex >= 0 &&
                dayItems.length > 1
            ) {

                dayItems.splice(
                    realIndex,
                    1
                );

                currentFocusItem =
                    dayItems[
                    Math.max(
                        0,
                        realIndex - 1
                    )
                    ] || null;

                save();

                render();
            }

            return;
        }

        if (
            e.key === "Backspace" &&
            active.textContent !== "" &&
            getCaretOffset(active) === 0
        ) {

            e.preventDefault();

            moveCaretHorizontallyAcrossItems(
                active,
                -1
            );
        }

        if (
            e.key === "Delete" &&
            active.textContent !== "" &&
            getCaretOffset(active) ===
            active.textContent.length
        ) {

            e.preventDefault();

            moveCaretHorizontallyAcrossItems(
                active,
                1
            );
        }

    }
);

// Ctrl+D 完成事项
document.addEventListener(
    "keydown",
    (e) => {

        if (
            !isPrimaryModifierPressed(e) ||
            e.key.toLowerCase() !== "d"
        ) {
            return;
        }

        e.preventDefault();

        const active =
            getActiveItemElement();

        if (
            !active ||
            !active.classList.contains("item")
        ) {
            return;
        }

        const item =
            active.memoItem;

        if (!item) {
            return;
        }

        if (
            active.textContent.trim() === ""
        ) {

            const dayItems =
                getTodayItems();

            const hasNonEmptyItem =
                dayItems.some(
                    x => x.text.trim() !== ""
                );

            if (
                hasNonEmptyItem &&
                dayItems.length > 1
            ) {

                const realIndex =
                    dayItems.indexOf(item);

                dayItems.splice(
                    realIndex,
                    1
                );

                currentFocusItem =
                    dayItems[
                    Math.max(
                        0,
                        realIndex - 1
                    )
                    ] || null;

                save();

                render();

            }

            return;
        }

        const visibleItems =
            getSortableCurrentItems();

        const currentIndex =
            visibleItems.indexOf(item);

        item.completed =
            !item.completed;

        if (
            hideCompleted &&
            item.completed
        ) {

            currentFocusItem =
                visibleItems[
                currentIndex + 1
                ] ||
                visibleItems[
                currentIndex - 1
                ] ||
                null;

        } else {

            currentFocusItem =
                item;
        }

        save();

        render();

    }
);

// Ctrl+Q 星标
document.addEventListener(
    "keydown",
    (e) => {

        if (
            !isPrimaryModifierPressed(e) ||
            e.key.toLowerCase() !== "q"
        ) {
            return;
        }

        e.preventDefault();

        const active =
            getActiveItemElement();

        if (
            !active ||
            !active.classList.contains("item")
        ) {
            return;
        }

        const item =
            active.memoItem;

        if (!item) {
            return;
        }

        item.starred =
            !item.starred;

        currentFocusItem =
            item;

        save();

        render();

    }
);

// Ctrl+W 持续事项
document.addEventListener(
    "keydown",
    (e) => {

        if (
            !isPrimaryModifierPressed(e) ||
            e.key.toLowerCase() !== "w"
        ) {
            return;
        }

        e.preventDefault();

        const active =
            getActiveItemElement();

        if (
            !active ||
            !active.classList.contains("item")
        ) {
            return;
        }

        const item =
            active.memoItem;

        if (!item) {
            return;
        }

        if (!item.persistent) {

            item.persistent =
                true;

            item.persistentEnd =
                null;

        } else {

            const itemDate =
                getItemDate(item);

            if (
                itemDate === currentDate
            ) {

                item.persistent =
                    false;

                item.persistentEnd =
                    null;

            } else {

                item.persistentEnd =
                    currentDate;

            }

        }

        currentFocusItem =
            item;

        save();

        render();

        requestAnimationFrame(() => {

            const target =
                getVisibleItemElements()
                    .find(
                        el =>
                            el.memoItem === item
                    );

            if (target) {

                target.scrollIntoView({
                    block: "nearest",
                    inline: "nearest"
                });

            }

        });

    }
);

// Ctrl+↑↓ 排序
document.addEventListener(
    "keydown",
    (e) => {

        if (
            !isPrimaryModifierPressed(e) ||
            (
                e.key !== "ArrowUp" &&
                e.key !== "ArrowDown"
            )
        ) {
            return;
        }

        e.preventDefault();

        const active =
            getActiveItemElement();

        if (
            !active ||
            !active.classList.contains("item")
        ) {
            return;
        }

        const item =
            active.memoItem;

        if (!item) {
            return;
        }

        if (item.persistent) {
            return;
        }

        const sortableItems =
            getSortableCurrentItems();

        const displayIndex =
            sortableItems.indexOf(item);

        if (displayIndex === -1) {
            return;
        }

        let targetIndex =
            displayIndex;

        if (
            e.key === "ArrowUp"
        ) {

            if (displayIndex <= 0) {
                return;
            }

            targetIndex =
                displayIndex - 1;

        } else {

            if (
                displayIndex >=
                sortableItems.length - 1
            ) {
                return;
            }

            targetIndex =
                displayIndex + 1;
        }

        const targetItem =
            sortableItems[targetIndex];

        const dayItems =
            getTodayItems();

        const from =
            dayItems.indexOf(item);

        const to =
            dayItems.indexOf(targetItem);

        if (
            from === -1 ||
            to === -1
        ) {
            return;
        }

        [
            dayItems[from],
            dayItems[to]
        ] = [
                dayItems[to],
                dayItems[from]
            ];

        currentFocusItem =
            item;

        save();

        render();

        requestAnimationFrame(() => {

            const target =
                getVisibleItemElements()
                    .find(
                        el =>
                            el.memoItem === item
                    );

            if (target) {

                target.scrollIntoView({
                    block: "nearest",
                    inline: "nearest"
                });

            }

        });

    }
);

// Ctrl+←→ 切换日期
document.addEventListener(
    "keydown",
    (e) => {

        if (
            !isPrimaryModifierPressed(e) ||
            (
                e.key !== "ArrowLeft" &&
                e.key !== "ArrowRight"
            )
        ) {
            return;
        }

        e.preventDefault();

        syncItemsFromDom();
        updateCurrentFocusFromSelection();

        const d =
            new Date(currentDate);

        if (
            e.key === "ArrowLeft"
        ) {

            d.setDate(
                d.getDate() - 1
            );

            playSlide(
                "slide-right"
            );

        } else {

            d.setDate(
                d.getDate() + 1
            );

            playSlide(
                "slide-left"
            );

        }

        const y =
            d.getFullYear();

        const m =
            String(
                d.getMonth() + 1
            ).padStart(2, "0");

        const day =
            String(
                d.getDate()
            ).padStart(2, "0");

        currentDate =
            `${y}-${m}-${day}`;

        currentFocusItem =
            focusMap[currentDate] ||
            null;

        getCurrentItems();

        save();
        render();

        setTimeout(() => {

            editor.scrollTop = 0;

            requestAnimationFrame(() => {

                const target =
                    getVisibleItemElements()
                        .find(
                            el =>
                                el.memoItem ===
                                currentFocusItem
                        );

                if (target) {
                    target.scrollIntoView({

                        block: "nearest",
                        behavior: "smooth"

                    });
                }

            });

        }, 40);

    }
);

// Ctrl+2调用
window.toggleCompleted = function () {

    hideCompleted =
        !hideCompleted;

    render();
};
