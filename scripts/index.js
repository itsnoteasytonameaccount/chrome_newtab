"strict mode"
{
  // 因为是在指定浏览器里运行，故可以毫无顾虑使用es6语法😊
  const { storage: { sync: syncStorage }, bookmarks, contextMenus, search: { query, Disposition: { NEW_TAB } } } = chrome
  const BG_PATH = "assets/bg/planet.png"
  const image = new Image()

  // 大图替换小图,避免直接加载大图导致严重闪烁
  image.addEventListener("load", function () {
    document.body.querySelector("main").style.backgroundImage = `url(${this.src})`
  })
  image.src = BG_PATH

  // 回调函数装饰器
  const createBookmark = promiseDecoration(bookmarks.create, bookmarks)
  const getRecent = promiseDecoration(bookmarks.getRecent, bookmarks)
  const storageSet = promiseDecoration(syncStorage.set, syncStorage)
  const storageGet = promiseDecoration(syncStorage.get, syncStorage)
  const getChildren = promiseDecoration(bookmarks.getChildren, bookmarks)
  const removeBookmark = promiseDecoration(bookmarks.remove, bookmarks)

  // 轮播控制
  let carousel = {
    _count: 0,
    _current: 0,
    _timerId: 0,
    maskRendered: false,
    // 读取到的书签
    loadedBookmarks: [],
    id: -1,
    // 因为页面数是根据其他数据计算得出，只能取不能设（页面指的是轮播的页面，不是整个页面）
    get page () {
      return this._count ? Math.ceil(this.loadedBookmarks.length / this._count) : 0
    },
    // 只能取，设置需要通过指定方法（根据容器宽度计算）
    get count () {
      return this._count
    },
    // 设置count并进行一些初始化
    async updateCount () {
      let carouselElement = document.querySelector("div.carousel")
      let val = Math.floor((carouselElement.offsetWidth - 1) / 140) * 2
      let padding = (carouselElement.offsetWidth - 1) % 140 / 2
      carouselElement.style.padding = "0 " + padding + "px"
      if (val !== this._count) {
        this._count = val
        if (this.loadedBookmarks.length === 0) {
          let { children, id } = await loadBookmarks()
          this.loadedBookmarks = children
          this.id = id
        }
        this.reset()
      }
    },
    // 读取
    get current () {
      return this._current
    },
    // 设置时更新界面
    set current (val) {
      if (val < 0 || val >= this.page) {
        return
      }
      if (val !== this._current) {
        let last = this._current
        let ul = document.querySelector("div.bookmarks ul")
        this._current = val
        ul.style.marginLeft = -100 * val + '%'
        this.initialPage(val)
        clearTimeout(this._timerId)

        // 删除其他页面的内容
        this._timerId = setTimeout(() => {
          if (last > -1) {
            this.selectPage(last).innerHTML = ""
          }
        }, 500)
      }
    },
    // 节点模板
    blockTemplate: ({ title, url, id }) => {
      id = id ? `_id="${id}"` : ""
      let img = url ? `<img class="md-icon" src="chrome://favicon/size/32@1x/${url}">` : "<i class='iconfont icon-add'></i>"
      return `<li class="bookmark-block" ${id}>
        <div class="content">
            <p>${img}
            </p>
            <p>${title}</p>
        </div>
        <a  ${url ? `href="${url}"` : ""} title="${title}" target="_blank"></a>
        <i class="iconfont icon-delete delete" ${id} ></i>
    </li>`
    },
    // 因为有增删操作，某页内容在显示之前都不会确定，故而在页面需要显示时才初始化页面（页面指的是轮播的页面，不是整个页面）
    initialPage (num) {
      let template = "",
        i = num * this._count,
        end = i + this._count >= this.loadedBookmarks.length ? this.loadedBookmarks.length : i + this._count,
        selected = this.selectPage(num)
      for (; i < end; i++) {
        template += this.blockTemplate(this.loadedBookmarks[i])
      }
      selected.innerHTML = template
      const addLi = selected.querySelector("li:not([_id])")
      if (addLi) {
        addLi.addEventListener("click", () => {
          document.querySelector(".mask").setAttribute("show", "true")
          if (!this.maskRendered) {
            this.maskRendered = true
            bookmarks.getTree(maskRenderer.bind(null, [document.querySelector(".menu-function.exist")]))
          }
        })
      }

      let actived = document.querySelector(`div.carousel div.switcher a.active`)
      actived && (actived.className = "")
      document.querySelector(`div.carousel div.switcher a:nth-child(${num + 1})`).className = "active"
    },
    // 重设内容
    reset () {
      const bookmarksContainer = document.querySelector("div.bookmarks"),
        switcher = bookmarksContainer.nextElementSibling, last = this._current
      let switcherTemplate = "",
        bookmarksTemplate = "",
        pagenum = carousel.page
      for (let page = 0; page < pagenum; page++) {
        bookmarksTemplate += "<ul></ul>"
        switcherTemplate += `<a _page='${page}'></a>`
      }
      bookmarksContainer.innerHTML = bookmarksTemplate
      switcher.innerHTML = switcherTemplate
      this._current = -1
      this.current = last
    },
    // 移除元素
    removeItem (id) {
      // 保留移除前的总页数
      let last = this.page
      let div = document.createElement("div")
      let target = document.querySelector(".bookmark-block i[_id='" + id + "'")
      let loadedBookmarks = this.loadedBookmarks
      let ind

      this.cached[id] = null
      target.parentNode.addEventListener("transitionend", function (e) {
        e.target.remove()
      })
      target.parentNode.className += " remove"
      // 查找要被移除的元素
      for (ind = this._current * this._count; ind < loadedBookmarks.length; ind++) {
        if (loadedBookmarks[ind].id === id) {
          break
        }
      }
      // 移除
      loadedBookmarks.splice(ind, 1)
      // 页面减少
      if (this.page < last) {
        this.selectPage(last - 1).remove()
        document.querySelector(`div.carousel div.switcher a:nth-child(${last})`).remove()
        // 当前页已销毁
        if (this._current === last - 1) {
          this.current--
        }
      }
      if (this._current < last - 1) {
        // 下一页的节点前移
        div.innerHTML = this.blockTemplate(loadedBookmarks[this._current * this._count + this._count - 1])
        this.selectPage(this._current).appendChild(div.childNodes[0])
      }
    },
    addItem (bookmark) {
      this.loadedBookmarks.splice(-1, 1, bookmark, {
        title: "添加",
        id: "",
        url: ""
      })
      this.reset()
    },
    selectPage: num => document.querySelector(`div.bookmarks ul:nth-child(${num + 1})`),
    cached: {},
    has (id) {
      if (this.cached[id]) {
        return true
      }
      let loadedBookmarks = this.loadedBookmarks
      let ind
      // 查找要被移除的元素
      for (ind = 0; ind < loadedBookmarks.length; ind++) {
        this.cached[loadedBookmarks[ind].id] = loadedBookmarks[ind]
        if (loadedBookmarks[ind].id === id) {
          return true
        }
      }
    }
  }

  // 节流
  function throttle (fn, step = 500) {
    let start = 0
    return function (...args) {
      let now = Date.now()
      if (now - start > step) {
        start = now
        fn.apply(this, args)
      }
    }
  }

  function contextmenuEvent (e) {
    let classList = this.className.split(" ")
    let cancelEdit = () => {
      this.className = this.className.replace("edit", "")
      window.removeEventListener("click", cancelEdit)
    }
    if (classList.indexOf("edit") < 0) {
      classList.push("edit")
      this.className = classList.join(" ")
      window.addEventListener("click", cancelEdit)
    }
    e.preventDefault()
  }

  // 初始化事件监听
  async function initialListener () {
    const bookmarksContainer = document.querySelector("div.bookmarks"),
      switcher = bookmarksContainer.nextElementSibling
    // 事件代理
    switcher.addEventListener("click", function (e) {
      // 避免切换页面时，编辑操作被取消
      e.stopPropagation()
      if (e.target === e.currentTarget) {
        return
      }
      let val = parseInt(e.target.getAttribute("_page"))
      carousel.current = val
    })
    // 删除操作
    bookmarksContainer.addEventListener("click", function (e) {
      let target = e.target
      let id
      e.stopPropagation()
      if (target.nodeName !== "I") {
        target = target.parentNode
      }
      if (target.nodeName === "I") {
        id = target.getAttribute("_id")
        if (id) {
          removeBookmark(id)
        }
      }
    })
    // 将右键菜单功能替换为启用编辑操作
    bookmarksContainer.addEventListener("contextmenu", contextmenuEvent)

    bookmarksContainer.addEventListener("mousewheel", throttle(function (e) {
      if (e.deltaX < -2) {
        carousel.current--
      } else if (e.deltaX > 2) {
        carousel.current++
      }
    }))
  }

  // 页面尺寸变化时重构页面
  window.addEventListener("resize", throttle(function () {
    carousel.updateCount()
  }))

  // 装饰器
  function promiseDecoration (fn, context) {
    return async function newfn (...args) {
      return await new Promise((resolve) => {
        fn.call(context, ...args, resolve)
      })
    }
  }

  // 加载最近保存的书签
  async function loadRecent () {
    let newBookmark = await createBookmark({ parentId: '1', index: 0, title: '扩展创建的书签目录' })
    let bookmarksData = {}

    bookmarksData.id = newBookmark.id

    let recentBookmarks = await getRecent(carousel.count)

    recentBookmarks.forEach(bookmark => {
      createBookmark({ parentId: bookmarksData.id, title: bookmark.title, url: bookmark.url })
    })
    storageSet({ bookmarks: bookmarksData })
    return { id: newBookmark.id, children: recentBookmarks }
  }

  // 加载书签
  async function loadBookmarks () {
    let bookmarksData
    let resultData = {}
    // storage是否存了id
    bookmarksData = await storageGet("bookmarks")
    // 若没存加载最近的书签
    if (!bookmarksData.bookmarks) {
      resultData = await loadRecent()
    } else {
      resultData.children = await getChildren(bookmarksData.bookmarks.id)
      if (!resultData.children) {
        resultData = await loadRecent()
      } else {
        resultData.id = bookmarksData.bookmarks.id
      }
    }
    // 添加按钮
    resultData.children.push({
      title: "添加",
      url: "",
      id: ""
    })
    return resultData
  }
  // 第一次初始化
  carousel.updateCount()
  initialListener()

  // 弹窗初始化等
  const markTemplate = ({ id, title, url }) => {
    let img = url ? `<img class="md-icon" src="chrome://favicon/size/16@1x/${url}"></img>` : ""
    return `<input class="bookmark_check" type="checkbox" id="bookmark${id}" title="${title}" value="${url}">
  <label for="bookmark${id}"><a class="iconfont" title="${title}">${img}${title}</a></label>`
  }

  function maskRenderer (nodes, trees, /* 测试用参数 */deep = 0) {
    let ul, li, children
    let newTrees = [], newNodes = []
    for (let i = 0; i < trees.length; i++) {
      children = trees[i].children
      ul = document.createElement("ul")
      ul.style.minHeight = 25 * children.length + "px"
      for (let j = 0; j < children.length; j++) {
        li = document.createElement("li")
        li.className = children[j].url ? "item" : "folder"
        li.innerHTML = markTemplate(children[j])
        ul.appendChild(li)
        if (children[j].children && children[j].children.length) {
          newTrees.push(children[j])
          newNodes.push(li)
        }
      }
      nodes[i] && nodes[i].appendChild(ul)
    }
    // 尾递归
    if (newTrees.length)
      return maskRenderer(newNodes, newTrees, deep + 1)
  }

  function message (str) {
    let messageBox = document.querySelector(".message")
    messageBox.querySelector("div").textContent = str
    messageBox.style.display = "block"
    setTimeout(() => messageBox.style.display = "none", 3000)
  }

  // 弹窗初始化
  function initialMask () {
    let mask = document.querySelector("div.mask")
    let foreground = mask.querySelector("div.foreground")
    // let sureBtn = foreground.querySelector("button.sure");
    // let cancelBtn
    foreground.addEventListener("animationend", function (e) {
      if (this.getAttribute("show") === "false") {
        this.parentNode.setAttribute("show", "false")
        this.setAttribute("show", "true")
      }
    })
    function clearAll (e, nodes = foreground.querySelectorAll("input[type='checkbox']:checked")) {
      foreground.setAttribute("show", "false")
      for (let i = 0; i < nodes.length; i++) {
        nodes[i].checked = false
      }
    }
    foreground.querySelector("button.sure").addEventListener("click", function () {
      let nodes = foreground.querySelectorAll(".item input[type='checkbox']:checked")
      let type = foreground.querySelector("input[type='radio']:checked").value
      let inputs
      if (type === "create") {
        inputs = foreground.querySelectorAll("input[type='text']")
        createBookmark({
          parentId: carousel.id,
          title: inputs[0].value,
          url: inputs[1].value
        }).then((res) => {
          if (!res) {
            message("新增失败，可能是链接格式不对")
            return
          }
        })
      } else {
        for (let i = 0; i < nodes.length; i++) {
          createBookmark({
            parentId: carousel.id,
            title: nodes[i].title,
            url: nodes[i].value
          })
        }
      }
      clearAll(null, nodes)
    })
    foreground.querySelector("button.cancel").addEventListener("click", clearAll)
  }
  initialMask()

  // 搜索框初始化
  function initialSearchBar () {
    const searchBar = document.querySelector(".search-bar input")
    searchBar.addEventListener("keyup", function (e) {
      if (e.keyCode === 13) {
        query({
          disposition: NEW_TAB,
          text: e.target.value
        })
      }
    })
  }
  initialSearchBar()


  contextMenus.onClicked.addListener(function (itemInfo) {
    if (itemInfo.menuItemId === "edit") {
      contextmenuEvent.call(document.querySelector("div.bookmarks"), { preventDefault () { } })
    }
  })

  function updateAll () {
    let existNode = document.querySelector(".menu-function.exist")
    existNode.innerHTML = ""
    carousel.maskRendered = false
  }
  bookmarks.onMoved.addListener(updateAll)
  bookmarks.onMoved.addListener(function (id, { oldParentId, parentId }) {
    if (oldParentId === parentId) {
      return
    }
    if (oldParentId === carousel.id) {
      if (carousel.has(id)) {
        carousel.removeItem(id)
      }
      return
    }
    if (parentId === carousel.id) {
      if (!carousel.has(id)) {
        bookmarks.get(id, ([bookmark]) => {
          carousel.addItem(bookmark)
        })
      } else {
        message("已存在该书签")
      }
    }
  })
  bookmarks.onCreated.addListener(updateAll)
  bookmarks.onCreated.addListener(function (id, bookmark) {
    if (bookmark.parentId === carousel.id) {
      carousel.addItem(bookmark)
    }
  })
  bookmarks.onRemoved.addListener(updateAll)
  bookmarks.onRemoved.addListener(function (id) {
    if (carousel.has(id)) {
      carousel.removeItem(id)
    }
  })
}