export const initJQueryExtensions = () => {
    // jQuery Effects Extensions
    $.fn.animateCard = function(options = {}) {
        const defaults = {
            duration: 400,
            scale: 1.05,
            shadow: '0 10px 20px rgba(0,0,0,0.2)',
            easing: 'easeOutQuad'
        };
        const settings = $.extend({}, defaults, options);

        return this.each(function() {
            const $card = $(this);
            const originalShadow = $card.css('box-shadow');
            const originalTransform = $card.css('transform');

            $card.css({
                transition: `all ${settings.duration}ms ${settings.easing}`,
                transform: `scale(${settings.scale})`,
                boxShadow: settings.shadow
            });

            setTimeout(() => {
                $card.css({
                    transform: originalTransform,
                    boxShadow: originalShadow
                });
            }, settings.duration);
        });
    };

    // NUEVO: Extensión para slide personalizado
    $.fn.slideEffect = function(direction = 'up', options = {}) {
        const defaults = {
            duration: 400,
            easing: 'swing',
            complete: null
        };
        const settings = $.extend({}, defaults, options);

        return this.each(function() {
            const $element = $(this);
            const height = $element.height();
            
            $element.css('overflow', 'hidden');

            if (direction === 'up') {
                $element.animate({ height: 0 }, {
                    duration: settings.duration,
                    easing: settings.easing,
                    complete: function() {
                        $element.hide();
                        if (settings.complete) settings.complete.call(this);
                    }
                });
            } else {
                $element.show().css('height', 0).animate({ height: height }, {
                    duration: settings.duration,
                    easing: settings.easing,
                    complete: settings.complete
                });
            }
        });
    };

    // NUEVO: Extensión para stop con limpieza
    $.fn.stopAndClear = function(clearQueue = true, jumpToEnd = true) {
        return this.each(function() {
            const $element = $(this);
            $element.stop(clearQueue, jumpToEnd);
            if (jumpToEnd) {
                $element.css('transition', 'none');
                setTimeout(() => {
                    $element.css('transition', '');
                }, 0);
            }
        });
    };

    // NUEVO: Extensión para siblings con filtrado
    $.fn.filteredSiblings = function(filter) {
        return this.siblings(filter).addBack(filter);
    };

    // jQuery CSS Extensions
    $.fn.enhanceTheme = function() {
        return this.each(function() {
            const $element = $(this);
            const isDark = $('html').hasClass('dark');
            
            if (isDark) {
                $element.find('.ui-slider').addClass('dark-mode');
                $element.find('.score-range').addClass('dark-mode');
            }
        });
    };

    // jQuery Clone Extensions
    $.fn.cloneWithEffect = function(options = {}) {
        const defaults = {
            duration: 300,
            offset: 50,
            opacity: 0
        };
        const settings = $.extend({}, defaults, options);

        return this.each(function() {
            const $original = $(this);
            const $clone = $original.clone(true);
            
            $clone.css({
                position: 'absolute',
                top: $original.offset().top,
                left: $original.offset().left,
                width: $original.width(),
                height: $original.height(),
                opacity: 1,
                zIndex: 1000
            }).appendTo('body');

            $clone.animate({
                top: `+=${settings.offset}`,
                opacity: settings.opacity
            }, settings.duration, function() {
                $(this).remove();
            });
        });
    };

    // NUEVO: Extensión noConflict personalizada
    $.fn.safeMode = function() {
        const $elements = this;
        const jQuery = $;
        
        return {
            execute: function(callback) {
                const $ = jQuery;
                callback.call($elements, $);
                return $elements;
            }
        };
    };

    // Enhanced Tooltip
    if (!$.fn.enhancedTooltip) {
        $.widget("custom.enhancedTooltip", {
            options: {
                position: {
                    my: "center bottom-20",
                    at: "center top"
                },
                show: {
                    effect: "fadeIn",
                    duration: 200
                },
                hide: {
                    effect: "fadeOut",
                    duration: 200
                },
                content: null,
                classes: {
                    "ui-tooltip": "custom-tooltip dark:bg-gray-800 dark:text-white dark:border-gray-600"
                }
            },

            _create() {
                this._super();
                this._bindEvents();
            },

            _bindEvents() {
                this._on({
                    mouseover: "show",
                    mouseout: "hide",
                    focusin: "show",
                    focusout: "hide"
                });
            },

            show(event) {
                const content = this.options.content || this.element.attr("title");
                if (!content) return;

                this.tooltip = $("<div>")
                    .addClass(this.options.classes["ui-tooltip"])
                    .html(content)
                    .appendTo("body");

                this._position(event);
                this.tooltip.fadeIn(this.options.show.duration);
            },

            hide() {
                if (this.tooltip) {
                    this.tooltip.fadeOut(this.options.hide.duration, () => {
                        this.tooltip.remove();
                    });
                }
            },

            _position(event) {
                if (!this.tooltip) return;
                const position = $.extend({}, this.options.position, {
                    of: event.target
                });
                this.tooltip.position(position);
            },

            destroy() {
                this.hide();
                this._super();
            }
        });
    }
};

// Función para aplicar las extensiones
export const applyJQueryExtensions = () => {
    // Mejorar las tarjetas de anime
    $('.anime-card').hover(
        function() { $(this).animateCard(); },
        function() { $(this).animateCard({ scale: 1 }); }
    );

    // Mejorar tooltips
    $('[data-tooltip]').enhancedTooltip({
        content: function() {
            return $(this).attr('data-tooltip');
        }
    });

    // Aplicar efectos a botones de favoritos
    $('.favorite-btn').on('click', function() {
        $(this).cloneWithEffect({
            offset: -30,
            duration: 500
        });
    });

    // Mejorar sliders y temas
    $('#scoreSlider').parent().enhanceTheme();
};

// Export default object
export default {
    initJQueryExtensions,
    applyJQueryExtensions
};